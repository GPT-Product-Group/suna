from fastapi import FastAPI, Request, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from agentpress.thread_manager import ThreadManager
from services.supabase import DBConnection
from datetime import datetime, timezone
from dotenv import load_dotenv
from utils.config import config, EnvMode
import asyncio
from utils.logger import logger
import uuid
import time
from collections import OrderedDict
from typing import Optional
from utils.auth_utils import get_current_user_id_from_jwt

# Import the agent API module
from agent import api as agent_api
from sandbox import api as sandbox_api
from services import billing as billing_api
from agent.prompt import get_user_prompt, save_user_prompt, delete_user_prompt

# Load environment variables (these will be available through config)
load_dotenv()

# Initialize managers
db = DBConnection()
thread_manager = None
instance_id = "single"

# Rate limiter state
ip_tracker = OrderedDict()
MAX_CONCURRENT_IPS = 25

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global thread_manager
    logger.info(f"Starting up FastAPI application with instance ID: {instance_id} in {config.ENV_MODE.value} mode")
    
    try:
        # Initialize database
        await db.initialize()
        thread_manager = ThreadManager()
        
        # Initialize the agent API with shared resources
        agent_api.initialize(
            thread_manager,
            db,
            instance_id
        )
        
        # Initialize the sandbox API with shared resources
        sandbox_api.initialize(db)
        
        # Initialize Redis connection
        from services import redis
        try:
            await redis.initialize_async()
            logger.info("Redis connection initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Redis connection: {e}")
            # Continue without Redis - the application will handle Redis failures gracefully
        
        # Start background tasks
        # asyncio.create_task(agent_api.restore_running_agent_runs())
        
        yield
        
        # Clean up agent resources
        logger.info("Cleaning up agent resources")
        await agent_api.cleanup()
        
        # Clean up Redis connection
        try:
            logger.info("Closing Redis connection")
            await redis.close()
            logger.info("Redis connection closed successfully")
        except Exception as e:
            logger.error(f"Error closing Redis connection: {e}")
        
        # Clean up database connection
        logger.info("Disconnecting from database")
        await db.disconnect()
    except Exception as e:
        logger.error(f"Error during application startup: {e}")
        raise

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def log_requests_middleware(request: Request, call_next):
    start_time = time.time()
    client_ip = request.client.host
    method = request.method
    url = str(request.url)
    path = request.url.path
    query_params = str(request.query_params)
    
    # Log the incoming request
    logger.info(f"Request started: {method} {path} from {client_ip} | Query: {query_params}")
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.debug(f"Request completed: {method} {path} | Status: {response.status_code} | Time: {process_time:.2f}s")
        return response
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(f"Request failed: {method} {path} | Error: {str(e)} | Time: {process_time:.2f}s")
        raise

# Define allowed origins based on environment
allowed_origins = ["https://www.suna.so", "https://suna.so", "https://staging.suna.so", "http://localhost:3000"]

# Add staging-specific origins
if config.ENV_MODE == EnvMode.STAGING:
    allowed_origins.append("http://localhost:3000")
    
# Add local-specific origins
if config.ENV_MODE == EnvMode.LOCAL:
    allowed_origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Include the agent router with a prefix
app.include_router(agent_api.router, prefix="/api")

# Include the sandbox router with a prefix
app.include_router(sandbox_api.router, prefix="/api")

# Include the billing router with a prefix
app.include_router(billing_api.router, prefix="/api")

@app.get("/api/health")
async def health_check():
    """Health check endpoint to verify API is working."""
    logger.info("Health check endpoint called")
    return {
        "status": "ok", 
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "instance_id": instance_id
    }

# 添加自定义prompt管理的API端点
@app.get("/api/custom-prompt/{user_id}", tags=["Custom Prompt"])
async def get_custom_prompt(user_id: str, request: Request):
    """获取指定用户的自定义prompt"""
    # 可以在这里添加认证检查，确保只有用户本人或管理员可以访问
    
    prompt = get_user_prompt(user_id)
    if prompt is None:
        return JSONResponse(
            status_code=404,
            content={"message": "未找到自定义prompt"}
        )
    
    return {"prompt": prompt}

@app.post("/api/custom-prompt/{user_id}", tags=["Custom Prompt"])
async def set_custom_prompt(user_id: str, request: Request, data: dict = Body(...)):
    """设置指定用户的自定义prompt"""
    # 可以在这里添加认证检查，确保只有用户本人或管理员可以设置
    
    prompt_text = data.get("prompt")
    if not prompt_text:
        return JSONResponse(
            status_code=400,
            content={"message": "提供的prompt不能为空"}
        )
    
    success = save_user_prompt(user_id, prompt_text)
    if not success:
        return JSONResponse(
            status_code=500,
            content={"message": "保存自定义prompt失败"}
        )
    
    return {"message": "自定义prompt设置成功"}

@app.delete("/api/custom-prompt/{user_id}", tags=["Custom Prompt"])
async def remove_custom_prompt(user_id: str, request: Request):
    """删除指定用户的自定义prompt"""
    # 可以在这里添加认证检查，确保只有用户本人或管理员可以删除
    
    success = delete_user_prompt(user_id)
    if not success:
        return JSONResponse(
            status_code=500,
            content={"message": "删除自定义prompt失败"}
        )
    
    return {"message": "自定义prompt已删除"}

@app.get("/api/prompt")
async def get_prompt(user_id: str = Depends(get_current_user_id_from_jwt)):
    """获取用户的自定义prompt"""
    prompt = get_user_prompt(user_id)
    return {"prompt": prompt}

@app.post("/api/prompt")
async def save_prompt(
    prompt: str = Body(..., embed=True),
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    """保存用户的自定义prompt"""
    success = save_user_prompt(user_id, prompt)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save prompt")
    return {"success": True}

@app.delete("/api/prompt")
async def reset_prompt(user_id: str = Depends(get_current_user_id_from_jwt)):
    """删除用户的自定义prompt，恢复使用默认prompt"""
    success = delete_user_prompt(user_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to reset prompt")
    return {"success": True}

if __name__ == "__main__":
    import uvicorn
    
    workers = 2
    
    logger.info(f"Starting server on 0.0.0.0:8000 with {workers} workers")
    uvicorn.run(
        "api:app", 
        host="0.0.0.0", 
        port=8000,
        workers=workers,
        # reload=True
    )
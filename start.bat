@echo off
chcp 65001 >nul
title POI 数据采集工具

cd /d "%~dp0"

:: 检查是否已安装依赖
if not exist "server\node_modules\" (
    echo [1/3] 首次运行，安装依赖...
    cd server && call npm install && cd ..
    cd client && call npm install && cd ..
)

:: 检查是否需要构建
if not exist "server\dist\" (
    echo [2/3] 构建后端...
    cd server && call npm run build && cd ..
)
if not exist "client\dist\" (
    echo [2/3] 构建前端...
    cd client && call npm run build && cd ..
)

:: 启动服务
echo [3/3] 启动服务...
start http://localhost:3001
cd server && node dist/index.js
pause

import json
from datetime import datetime
from typing import List, Dict, Any
import uuid # Necesario para generar IDs únicos

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

# ---------------------------------------------
# Configuración y Archivos
# ---------------------------------------------
app = FastAPI()
DATA_FILE = 'data.json'
# Asume que la carpeta 'templates' está al mismo nivel que 'main.py'
templates = Jinja2Templates(directory="templates") 

# Modelo de datos para validar la entrada (Pydantic)
class Movimiento(BaseModel):
    # El ID es opcional en la entrada, pero se asigna al guardar
    id: str | None = None
    fecha: str
    asunto: str
    tipo: str
    cantidad: float 

# ---------------------------------------------
# Funciones de Gestión de Datos
# ---------------------------------------------

def load_data() -> List[Dict[str, Any]]:
    """Carga los datos del archivo JSON. Si falla, lo inicializa."""
    try:
        with open(DATA_FILE, 'r') as f:
            data = f.read()
            # Devuelve los datos si existen, o una lista vacía si el archivo está vacío
            return json.loads(data) if data else []
    except (FileNotFoundError, json.JSONDecodeError):
        # Inicializa un archivo JSON vacío si no existe o es inválido
        with open(DATA_FILE, 'w') as f:
            f.write("[]") 
        return []

def save_data(data: List[Dict[str, Any]]):
    """Guarda la lista de datos en el archivo JSON."""
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=4)

def sort_and_recalculate(data: List[Dict[str, Any]]) -> tuple[List[Dict[str, Any]], Dict[str, float]]:
    """Ordena los datos por fecha (más reciente primero) y calcula saldos."""
    
    # 1. Ordenar por fecha (más nueva a más vieja)
    try:
        data.sort(key=lambda x: datetime.strptime(x.get('fecha', '1970-01-01'), '%Y-%m-%d'), reverse=True)
    except ValueError:
        # En caso de error de formato de fecha, se ignora la ordenación por fecha.
        pass
        
    # 2. Recalcular saldos (redondeados a 2 decimales)
    saldo_banco = sum(mov.get('cantidad', 0) for mov in data if mov.get('tipo') == 'BANCO')
    saldo_cash = sum(mov.get('cantidad', 0) for mov in data if mov.get('tipo') == 'CASH')
    
    saldos = {
        'banco': round(saldo_banco, 2),
        'cash': round(saldo_cash, 2),
        'total': round(saldo_banco + saldo_cash, 2)
    }
    
    return data, saldos

# ---------------------------------------------
# Rutas de la Aplicación (API)
# ---------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Ruta principal: Muestra la interfaz web."""
    movimientos = load_data()
    movimientos_ordenados, saldos = sort_and_recalculate(movimientos)
    
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "movimientos": movimientos_ordenados, "saldos": saldos}
    )

@app.post("/guardar")
async def guardar_movimiento(movimiento: Movimiento):
    """Guarda un nuevo movimiento, asignando un ID único."""
    
    movimientos = load_data()
    
    # Asignar un ID único (necesario para la eliminación)
    nuevo_movimiento = movimiento.dict()
    nuevo_movimiento['id'] = str(uuid.uuid4())
    
    movimientos.append(nuevo_movimiento)
    save_data(movimientos)
    
    movimientos_ordenados, saldos = sort_and_recalculate(movimientos)
    
    return {
        'movimientos': movimientos_ordenados,
        'saldos': saldos
    }

@app.delete("/eliminar/{movimiento_id}")
async def eliminar_movimiento(movimiento_id: str):
    """Ruta DELETE: Elimina un movimiento por su ID."""
    
    movimientos = load_data()
    
    # Busca el índice del movimiento con el ID dado
    try:
        index_to_delete = next(i for i, mov in enumerate(movimientos) if mov.get('id') == movimiento_id)
    except StopIteration:
        # Si el ID no se encuentra, lanza un error HTTP 404
        raise HTTPException(status_code=404, detail="Movimiento no encontrado.")
    
    # Eliminar el movimiento y guardar
    movimientos.pop(index_to_delete)
    save_data(movimientos)
    
    movimientos_ordenados, saldos = sort_and_recalculate(movimientos)
    
    # Devuelve la lista y saldos actualizados
    return {
        'movimientos': movimientos_ordenados,
        'saldos': saldos
    }

# Para iniciar el servidor (ejecutar desde la carpeta principal):
# uvicorn main:app --reload
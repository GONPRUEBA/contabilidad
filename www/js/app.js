// ===========================================================
// app.js — Contabilidad Local
// ===========================================================

// Gestión de datos local
class GestorDatos {
    constructor() {
        this.datos = this.cargarDatos();
        this.calcularSaldos();
    }

    cargarDatos() {
        const datosGuardados = localStorage.getItem('contabilidad_datos');
        return datosGuardados ? JSON.parse(datosGuardados) : { movimientos: [], saldos: { banco: 0, cash: 0, total: 0 } };
    }

    guardarDatos() {
        localStorage.setItem('contabilidad_datos', JSON.stringify(this.datos));
        this.calcularSaldos();
        return this.datos;
    }

    calcularSaldos() {
        const saldoBanco = this.datos.movimientos.filter(m => m.tipo === 'BANCO').reduce((sum, mov) => sum + mov.cantidad, 0);
        const saldoCash = this.datos.movimientos.filter(m => m.tipo === 'CASH').reduce((sum, mov) => sum + mov.cantidad, 0);
        this.datos.saldos = {
            banco: Math.round(saldoBanco * 100) / 100,
            cash: Math.round(saldoCash * 100) / 100,
            total: Math.round((saldoBanco + saldoCash) * 100) / 100
        };
    }

    agregarMovimiento(movimiento) {
        movimiento.id = Date.now().toString();
        movimiento.fecha = movimiento.fecha || new Date().toISOString().split('T')[0];
        this.datos.movimientos.push(movimiento);
        return this.guardarDatos();
    }

    eliminarMovimiento(id) {
        this.datos.movimientos = this.datos.movimientos.filter(m => m.id !== id);
        return this.guardarDatos();
    }

    modificarMovimiento(id, movimientoActualizado) {
        const index = this.datos.movimientos.findIndex(m => m.id === id);
        if (index !== -1) {
            movimientoActualizado.id = id;
            this.datos.movimientos[index] = movimientoActualizado;
            return this.guardarDatos();
        }
        return this.datos;
    }

    importarDatos(jsonData) {
        try {
            this.datos = JSON.parse(jsonData);
            this.guardarDatos();
            return true;
        } catch {
            return false;
        }
    }

    exportarDatos() {
        return JSON.stringify(this.datos, null, 2);
    }
}

// ===========================================================
// Variables globales
// ===========================================================
let editandoMovimientoId = null;
let todosLosMovimientos = [];
const gestorDatos = new GestorDatos();

// ===========================================================
// Inicialización
// ===========================================================
document.addEventListener('DOMContentLoaded', () => {
    const datos = gestorDatos.datos;
    todosLosMovimientos = datos.movimientos;
    actualizarTablaYDom(datos);
});

// ===========================================================
// CRUD y DOM
// ===========================================================
function actualizarTablaYDom(datos) {
    const tablaBody = document.getElementById('tablaMovimientos');
    tablaBody.innerHTML = '';

    datos.movimientos.forEach(mov => {
        const fila = tablaBody.insertRow();
        fila.id = `movimiento-${mov.id}`;
        fila.insertCell().textContent = mov.fecha;
        fila.insertCell().textContent = mov.asunto;
        fila.insertCell().textContent = mov.tipo;
        fila.insertCell().textContent = parseFloat(mov.cantidad).toFixed(2) + ' €';

        const cellAcciones = fila.insertCell();
        cellAcciones.innerHTML = `
            <div class="acciones-botones">
                <button class="btn-modificar" onclick="iniciarModificacion('${mov.id}')">✏️</button>
                <button class="btn-eliminar" onclick="eliminarMovimiento('${mov.id}')">🗑️</button>
            </div>
        `;
    });

    document.getElementById('saldoBanco').textContent = datos.saldos.banco.toFixed(2);
    document.getElementById('saldoCash').textContent = datos.saldos.cash.toFixed(2);
    document.getElementById('saldoTotal').textContent = datos.saldos.total.toFixed(2);

    editandoMovimientoId = null;
    document.querySelector('button[onclick="guardarMovimiento()"]').textContent = 'OK / GUARDAR';
    todosLosMovimientos = datos.movimientos;
}

// ===========================================================
// Guardar movimiento con soporte negativo
// ===========================================================
function guardarMovimiento() {
    const fecha = document.getElementById('inputFecha').value.trim();
    const asunto = document.getElementById('inputAsunto').value.trim();
    const tipo = document.getElementById('inputTipo').value;
    const cantidadStr = document.getElementById('inputCantidad').value.trim();

    if (!fecha || !asunto || !tipo || !cantidadStr) {
        alert("Por favor, rellena todos los campos.");
        return;
    }

    // Convierte la cantidad a número, reemplaza coma y acepta negativo
    const cantidad = Number(cantidadStr.replace(',', '.'));
    if (!isFinite(cantidad)) {
        alert("La cantidad debe ser un número válido (usa - para gastos).");
        return;
    }

    const movimientoData = { fecha, asunto, tipo, cantidad };

    const datos = editandoMovimientoId
        ? gestorDatos.modificarMovimiento(editandoMovimientoId, movimientoData)
        : gestorDatos.agregarMovimiento(movimientoData);

    actualizarTablaYDom(datos);
    limpiarFormulario();
}

function limpiarFormulario() {
    document.getElementById('inputFecha').value = '';
    document.getElementById('inputAsunto').value = '';
    document.getElementById('inputTipo').value = '';
    document.getElementById('inputCantidad').value = '';
    document.getElementById('inputFecha').focus();
}

function eliminarMovimiento(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este movimiento?')) return;
    const datos = gestorDatos.eliminarMovimiento(id);
    actualizarTablaYDom(datos);
}

function iniciarModificacion(id) {
    const mov = todosLosMovimientos.find(m => m.id === id);
    if (!mov) return;

    document.getElementById('inputFecha').value = mov.fecha;
    document.getElementById('inputAsunto').value = mov.asunto;
    document.getElementById('inputTipo').value = mov.tipo;
    document.getElementById('inputCantidad').value = mov.cantidad;

    editandoMovimientoId = id;
    document.querySelector('button[onclick="guardarMovimiento()"]').textContent = 'ACTUALIZAR';
    document.querySelector('.formulario').scrollIntoView({ behavior: 'smooth' });
}

// ===========================================================
// Filtros
// ===========================================================
function aplicarFiltros() {
    const fechaDesde = document.getElementById('filtroFechaDesde').value;
    const fechaHasta = document.getElementById('filtroFechaHasta').value;
    const cantidadMin = document.getElementById('filtroCantidadMin').value;
    const cantidadMax = document.getElementById('filtroCantidadMax').value;
    const tipo = document.getElementById('filtroTipo').value;

    let movs = [...todosLosMovimientos];
    if (fechaDesde) movs = movs.filter(m => m.fecha >= fechaDesde);
    if (fechaHasta) movs = movs.filter(m => m.fecha <= fechaHasta);
    if (cantidadMin) movs = movs.filter(m => m.cantidad >= parseFloat(cantidadMin));
    if (cantidadMax) movs = movs.filter(m => m.cantidad <= parseFloat(cantidadMax));
    if (tipo) movs = movs.filter(m => m.tipo === tipo);

    actualizarTablaYDom({ movimientos: movs, saldos: gestorDatos.datos.saldos });
}

function limpiarFiltros() {
    document.getElementById('filtroFechaDesde').value = '';
    document.getElementById('filtroFechaHasta').value = '';
    document.getElementById('filtroCantidadMin').value = '';
    document.getElementById('filtroCantidadMax').value = '';
    document.getElementById('filtroTipo').value = '';
    actualizarTablaYDom(gestorDatos.datos);
}

// ===========================================================
// Exportar / Importar - SOLO JAVASCRIPT PURO
// ===========================================================
function exportarDatos() {
    try {
        const datos = gestorDatos.exportarDatos();
        const nombreArchivo = 'contabilidad_data_' + new Date().toISOString().split('T')[0] + '.json';
        
        // Método principal: Blob + URL.createObjectURL
        const blob = new Blob([datos], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombreArchivo;
        enlace.style.display = 'none';
        
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        
        // Liberar memoria después de un tiempo
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 5000);
        
        alert('✅ Datos exportados. Revisa tu carpeta de "Descargas".');
        
    } catch (error) {
        console.error('Error en exportación:', error);
        alert('❌ Error al exportar. Usa el método alternativo.');
    }
}

function exportarDatosAlternativo() {
    const datos = gestorDatos.exportarDatos();
    const nombreArchivo = 'contabilidad_data_' + new Date().toISOString().split('T')[0] + '.json';
    
    // Método alternativo: nueva ventana para copiar/pegar
    const nuevaVentana = window.open('', '_blank');
    if (!nuevaVentana) {
        alert('⚠️ Por favor, permite ventanas emergentes para este sitio');
        return;
    }
    
    nuevaVentana.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Exportar Datos Contabilidad</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    padding: 20px; 
                    max-width: 800px; 
                    margin: 0 auto; 
                    line-height: 1.6;
                    background: #f5f5f5;
                }
                .container { 
                    background: white; 
                    padding: 25px; 
                    border-radius: 8px; 
                    border: 1px solid #ddd;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                h1 { color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
                pre { 
                    background: #2d2d2d; 
                    color: #f8f8f2; 
                    padding: 15px; 
                    border-radius: 5px; 
                    overflow-x: auto;
                    font-size: 12px;
                    max-height: 400px;
                    overflow-y: auto;
                    border: 1px solid #444;
                }
                .botones { 
                    margin: 20px 0; 
                    text-align: center;
                }
                button { 
                    padding: 12px 20px; 
                    margin: 8px; 
                    border: none; 
                    border-radius: 5px; 
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: bold;
                    transition: background 0.3s;
                }
                .copiar { background: #28a745; color: white; }
                .copiar:hover { background: #218838; }
                .instrucciones { 
                    background: #fff3cd; 
                    border: 1px solid #ffeaa7; 
                    padding: 15px; 
                    border-radius: 5px;
                    margin: 15px 0;
                    color: #856404;
                }
                .exito { 
                    background: #d4edda; 
                    border: 1px solid #c3e6cb; 
                    padding: 10px; 
                    border-radius: 5px;
                    margin: 10px 0;
                    color: #155724;
                    display: none;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>📊 Datos de Contabilidad Exportados</h1>
                
                <div class="instrucciones">
                    <h3>📝 Instrucciones para guardar:</h3>
                    <p><strong>Opción 1 (Recomendada):</strong> Usa el botón "Copiar Texto" y luego pégalo en un archivo nuevo llamado <strong>${nombreArchivo}</strong></p>
                    <p><strong>Opción 2:</strong> Selecciona y copia manualmente el texto de abajo (ya está seleccionado)</p>
                    <p><strong>Opción 3:</strong> Toma captura de pantalla si solo necesitas consulta rápida</p>
                    <p><em>Puedes cerrar esta ventana cuando termines</em></p>
                </div>
                
                <div class="exito" id="mensajeExito">✅ Texto copiado al portapapeles correctamente</div>
                
                <div class="botones">
                    <button class="copiar" onclick="copiarTexto()">📋 Copiar Texto</button>
                </div>
                
                <pre id="datosJson">${datos}</pre>
                
                <script>
                    function copiarTexto() {
                        const texto = document.getElementById('datosJson').innerText;
                        navigator.clipboard.writeText(texto).then(() => {
                            document.getElementById('mensajeExito').style.display = 'block';
                            setTimeout(() => {
                                document.getElementById('mensajeExito').style.display = 'none';
                            }, 3000);
                        }).catch(err => {
                            alert('❌ Error al copiar: ' + err);
                        });
                    }
                    
                    // Auto-seleccionar texto para facilitar copia manual
                    window.onload = function() {
                        const pre = document.getElementById('datosJson');
                        const range = document.createRange();
                        range.selectNodeContents(pre);
                        const selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                    };
                </script>
            </div>
        </body>
        </html>
    `);
    
    nuevaVentana.document.close();
}

function manejarImportacion() {
    const input = document.getElementById('inputArchivo');
    const archivo = input.files[0];
    if (!archivo) return;
    if (!archivo.name.toLowerCase().endsWith('.json')) {
        alert('Solo se permiten archivos JSON.');
        input.value = '';
        return;
    }
    if (!confirm(`Importar el archivo "${archivo.name}"? Esto sobrescribirá tus datos.`)) {
        input.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        if (gestorDatos.importarDatos(e.target.result)) {
            alert("✅ Importación exitosa.");
            actualizarTablaYDom(gestorDatos.datos);
        } else {
            alert("❌ JSON no válido.");
        }
    };
    reader.readAsText(archivo);
    input.value = '';
}
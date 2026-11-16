# ACMC 2026 Rungler — Fase 1.1: auditoría de interfaz y contrato DSP

Fecha: 27 de octubre de 2026. Base Git: `bc15ecaeb50a831f3aa2756124d44720d77b4efd`, con los cambios locales de Fase 1 todavía sin commit. Auditoría del código local, no de una exportación RNBO ni de un engine operativo.

Se crea exclusivamente este documento. No se cambian parámetros, componentes, implementación, dependencias o publicación. No se hace commit ni push. **Existente**, **hallazgo** y **propuesta pendiente de aprobación** se distinguen a continuación.

## 1. Inventario real: 27 parámetros

Fuente ejecutada directamente: `lab/js/core/parameters.js`. Recuento: 0A=4, 0B=4, 1=6, 2=4, 3=4, 4=5. Los controles globales no están en este registro y no se cuentan.

Todos los IDs RNBO están **sin definir**: no hay campo de mapeo, exportación ni puerto concreto. La función didáctica de la tabla es una interpretación provisional del nombre/contexto; no describe un efecto DSP implementado. En ejecución, todos actualizan el almacén. Solo el primer parámetro de cada etapa modifica además el tamaño de dibujos de demostración; no modifica tasas, espectros o estados físicos.

“Adim. UI” significa unidad vacía en el registro, no una calibración física. Los Hz están declarados como texto; su interpretación necesita las definiciones indicadas. Todos los parámetros siguen pendientes de definición topológica o física suficiente para DSP.

| Etapa | ID estable UI | Nombre visible | Tipo | Mín. | Máx. | Inicial | Unidad | Escalado efectivo; paso | ID RNBO | Función prevista / definición pendiente |
|---|---|---|---|---:|---:|---:|---|---|---|---|
| 0A | `0A.rate` | Variation rate | knob | 0.05 | 30 | 1 | Hz | Logarítmico; 0.01 | No definido | Intención: rapidez de variación. No define un proceso ni una frecuencia medible; ambigüedad crítica. |
| 0A | `0A.depth` | Depth | knob | 0 | 1 | 0.5 | Adim. UI | Lineal; 0.01 | No definido | Intención: amplitud de variación. Faltan distribución, referencia, ganancia y punto de aplicación. |
| 0A | `0A.offset` | Offset | knob | -1 | 1 | 0 | Adim. UI | Lineal; 0.01 | No definido | Intención: desplazamiento DC. Faltan escala CV, orden respecto a Depth y límites. |
| 0A | `0A.bipolar` | Bipolar | toggle | 0 | 1 | 1 | Adim. UI | Discreto (metadato: linear); 1 | No definido | Intención: salida uni/bipolar. No define transformación, distribución ni interacción con Offset. |
| 0B | `0B.clock` | Clock rate | knob | 0.1 | 40 | 2 | Hz | Logarítmico; 0.01 | No definido | Intención: tasa del reloj de muestreo. Faltan fuente, flanco, fase y comportamiento de arranque. |
| 0B | `0B.depth` | Depth | knob | 0 | 1 | 0.5 | Adim. UI | Lineal; 0.01 | No definido | Intención: amplitud de valores retenidos. Faltan fuente/distribución, escala CV y posición respecto al cuantizador. |
| 0B | `0B.quantize` | Quantizer | toggle | 0 | 1 | 0 | Adim. UI | Discreto (metadato: linear); 1 | No definido | Intención: activar cuantizador. Faltan mapa CV→altura, referencia, redondeo, rango e histéresis. |
| 0B | `0B.scale` | Scale | select | 0 | 2 | 0 | Adim. UI | Discreto (metadato: linear); 1 | No definido | Intención: conjunto diatónico. Faltan tónica, afinación, octavas y reglas del cuantizador. |
| 1 | `1.vcoA` | VCO A frequency | knob | 0.1 | 2000 | 110 | Hz | Logarítmico; 0.1 | No definido | Intención: frecuencia base de A. Faltan forma de onda, fase, ley de FM y límites efectivos. |
| 1 | `1.vcoB` | VCO B frequency | knob | 0.1 | 2000 | 70 | Hz | Logarítmico; 0.1 | No definido | Intención: frecuencia base de B. Faltan forma de onda, fase, ley de FM y límites efectivos. |
| 1 | `1.feedbackA` | FM depth A | knob | 0 | 1 | 0.3 | Adim. UI | Lineal; 0.01 | No definido | Intención: profundidad de FM hacia A. Falta conversión a Hz/V, octavas/V o índice definido. |
| 1 | `1.feedbackB` | FM depth B | knob | 0 | 1 | 0.3 | Adim. UI | Lineal; 0.01 | No definido | Intención: profundidad de FM hacia B. Falta conversión a Hz/V, octavas/V o índice definido. |
| 1 | `1.clockSource` | Clock source | select | 0 | 1 | 0 | Adim. UI | Discreto (metadato: linear); 1 | No definido | Intención: seleccionar reloj. Falta regla complementaria para DATA al elegir B. |
| 1 | `1.feedback` | Feedback path | toggle | 0 | 1 | 1 | Adim. UI | Discreto (metadato: linear); 1 | No definido | Intención: conectar/desconectar retorno. Faltan aristas afectadas, estado retenido y suavizado. |
| 2 | `2.pulseWidth` | Pulse width | knob | 0.05 | 0.95 | 0.5 | Adim. UI | Lineal; 0.01 | No definido | Intención: ancho de pulso. No se especifica si es duty cycle, umbral o sesgo de comparador. |
| 2 | `2.modDepth` | Modulation depth | knob | 0 | 1 | 0.25 | Adim. UI | Lineal; 0.01 | No definido | Intención: cantidad de modulación PWM. Faltan ley, escala, saturación y destino exacto. |
| 2 | `2.source` | Modulation source | select | 0 | 2 | 0 | Adim. UI | Discreto (metadato: linear); 1 | No definido | Intención: fuente de modulación. Faltan identidad/instancia, señal concreta, polaridad y escala. |
| 2 | `2.invert` | Invert output | toggle | 0 | 1 | 0 | Adim. UI | Discreto (metadato: linear); 1 | No definido | Intención: invertir salida. Falta distinguir inversión lógica, signo de audio o complementar duty cycle. |
| 3 | `3.peakA` | Peak A frequency | knob | 30 | 12000 | 450 | Hz | Logarítmico; 1 | No definido | Intención: frecuencia del pico A. Falta definir si es parámetro del modelo o máximo espectral resultante. |
| 3 | `3.peakB` | Peak B frequency | knob | 30 | 12000 | 1300 | Hz | Logarítmico; 1 | No definido | Intención: frecuencia del pico B. Falta definir si es parámetro del modelo o máximo espectral resultante. |
| 3 | `3.resonance` | Resonance | knob | 0 | 1 | 0.4 | Adim. UI | Lineal; 0.01 | No definido | Intención: resonancia. No equivale todavía a Q, amortiguamiento ni ganancia de retorno definidos. |
| 3 | `3.exciter` | Exciter | select | 0 | 2 | 0 | Adim. UI | Discreto (metadato: linear); 1 | No definido | Intención: elegir excitación. Faltan fuente, amplitud, ancho de banda, acoplamiento y energía. |
| 4 | `4.couplingAB` | Coupling A → B | knob | 0 | 1 | 0.3 | Adim. UI | Lineal; 0.01 | No definido | Intención: acoplar sistema A hacia B. Faltan nodos, ley, signo, retardo y normalización. |
| 4 | `4.couplingBA` | Coupling B → A | knob | 0 | 1 | 0.3 | Adim. UI | Lineal; 0.01 | No definido | Intención: acoplar sistema B hacia A. Faltan nodos, ley, signo, retardo y normalización. |
| 4 | `4.balance` | System balance | knob | -1 | 1 | 0 | Adim. UI | Lineal; 0.01 | No definido | Intención: balance entre sistemas. No define mezcla, panorama ni modificación del acoplamiento. |
| 4 | `4.crossFeedback` | Cross feedback | toggle | 0 | 1 | 1 | Adim. UI | Discreto (metadato: linear); 1 | No definido | Intención: habilitar retorno cruzado. Faltan aristas afectadas y política de estado. |
| 4 | `4.routing` | Output routing | select | 0 | 2 | 0 | Adim. UI | Discreto (metadato: linear); 1 | No definido | Intención: elegir salida. Faltan canales, punto de toma y ganancia de Combined. |

Opciones exactas; los índices y el orden son parte del estado UI:

- `0A.bipolar`, `0B.quantize`, `1.feedback`, `2.invert`, `4.crossFeedback`: 0=OFF, 1=ON.
- `0B.scale`: 0=Major, 1=Natural minor, 2=Dorian.
- `1.clockSource`: 0=VCO A, 1=VCO B.
- `2.source`: 0=VCO A, 1=VCO B, 2=Register CV.
- `3.exciter`: 0=Pulse, 1=Noise, 2=Register CV.
- `4.routing`: 0=System A, 1=System B, 2=Combined.

Los knobs logarítmicos se interpolan logarítmicamente, pero se redondean en unidades declaradas usando un paso lineal. Los sliders tienen resolución UI 0…1000: eso no garantiza poder seleccionar con ratón todos los valores de la rejilla física. No existe entrada numérica editable ni mecanismo de presets exactos. No se modifica nada aquí.

## 2. API y flujo existentes

### 2.1 ParameterStore

`new ParameterStore()` crea un Map con los 27 valores iniciales. `get(id)` devuelve un valor o lanza RangeError. `set(id,value,source='ui')` limita/redondea, muta el Map y notifica sincrónicamente `{id,value,source}` si cambió. `snapshot(stageId)` devuelve un objeto nuevo con los valores de esa etapa. `reset(stageId)` aplica cada inicial con source=reset, uno por uno; no es transacción. `subscribe(listener)` devuelve una función de baja, sin emisión inicial.

Se aceptan números finitos, no cadenas numéricas ni booleanos JS. Los toggles usan números 0/1. El recorte se hace a min/max; redondeo a la rejilla min+n·step y 8 decimales. Valores fraccionarios de selectores/toggles se redondean, no se rechazan. No hay validación física entre parámetros ni validación del campo source. Un listener que lanza interrumpe el resto de notificaciones; el valor ya ha cambiado.

### 2.2 RNBOAdapter: API pública real

Es un facade genérico con nombre RNBOAdapter; **no llama a la API de RNBO**. `main.js` instancia uno y nunca llama a connect.

| Miembro | Comportamiento implementado |
|---|---|
| `new RNBOAdapter()` | Sin argumentos; sin puerto, sin AudioContext ni runtime. |
| `status` | Getter síncrono: ready si existe #port; unavailable en caso contrario. No distingue loading, error, suspended o running. |
| `connect(port)` | Promise; rechaza si disposed, conectando o conectado. Exige contractVersion===1 y seis métodos; espera initialize, instala telemetría, asigna puerto y emite status ready. No devuelve el device; resuelve undefined. |
| `setStage(id,values)` | Promise<boolean>; valida etapa y todos sus valores y construye snapshot limitado. Ignora claves extra. Sin puerto devuelve false. Con puerto espera port.setStage y devuelve true. No conserva etapa activa ni garantiza atomicidad. |
| `setParameter(id,value)` | Promise<boolean>; busca descriptor, limita/redondea y envía el mismo ID UI y valor declarado a port.setParameter. Sin puerto devuelve false. No comprueba pertenencia a una etapa activa. |
| `command(name,value?)` | Promise<boolean>; nombres start, mute, masterLevel, panic. mute exige boolean; masterLevel exige número finito 0…1. start/panic no validan payload. Sin puerto false; con puerto espera comando y devuelve true. |
| `subscribe(listener)` | Alta en Set; devuelve función de baja. Sin validación de callable ni snapshot inicial. |
| `dispose()` | Marca disposed, llama a la baja de telemetría, limpia referencia/listeners y espera port.dispose. Resuelve undefined; idempotente en ruta nominal. No se permite reconectar esa instancia después. |

Puerto exigido actualmente (interfaz propia, no interfaz nativa de Cycling '74):

`{contractVersion:1, initialize(), setStage(id,snapshot), setParameter(id,value), command(name,value), subscribeTelemetry(callback), dispose()}`.

Se esperan métodos async/compatibles con await. subscribeTelemetry debe devolver una **función** de cleanup. initialize no recibe configuración; el futuro puerto tendría que recibirla en su propio constructor. La interfaz no tiene reset de estado DSP, semillas, timestamps de comandos, cancelación, consulta de dispositivos ni lectura inicial de parámetros.

Eventos del facade: `{type:'status',status:'ready'}` y `{type:'telemetry',payload:eventDelPuerto}`. No existe validación del payload, unidades, canales, frecuencia o procedencia, ni eventos de error/unavailable/disposed. No existe método para solicitar streams.

### 2.3 IDs, transporte y sincronización

- **UI→puerto:** Control → store.set → listener en main → adapter.setParameter; source=engine evita reenvío. Navegar invoca adapter.setStage con snapshot. Promesas se capturan con un anuncio genérico; no hay rollback.
- **UI→RNBO:** no está implementado. Los IDs UI se pasan sin transformar; nadie los vincula a parametersById de un Device. No hay conversiones, validación contra metadatos exportados ni manifest.
- **RNBO→UI:** no está implementado. El controlador no se suscribe al adapter y el facade no escucha parameterChangeEvent. La excepción source=engine es solo un punto preparatorio; nada la usa para recibir valores RNBO. La UI refleja el valor solicitado, no un valor efectivo confirmado.
- **Telemetría→plots:** no está implementado. GraphicDemo alimenta cuatro clases Canvas con arrays de coordenadas arbitrarias, independientemente del facade. No existe monitor digital del registro.
- **Offline:** los métodos válidos devuelven false, descartando envíos. El store conserva valores, pero no hay cola ni resincronización automática al conectar. Debe aplicarse explícitamente un snapshot validado después del futuro handshake.
- **Orden:** llamadas se inician en orden JS, pero no se serializa su finalización. Reset envía varios cambios, no un bloque atómico. No hay backpressure/coalescing, revisión de comando, reloj DSP ni protección frente a cambios de etapa en vuelo.

### 2.4 Hallazgos reproducibles y límites de errores

**P0 antes de conectar audio, sin correcciones en esta auditoría:**

1. `if (!PARAMETERS[id])` acepta propiedades heredadas. Con puerto de prueba, `setParameter('constructor',1)` envía `['constructor',NaN]`. Se verificó en memoria. Usar lookup de propiedad propia/Map y validar de nuevo el resultado antes de enviarlo. El store acaba rechazando ese ID al consultar su Map, pero la validación del facade sí falla.
2. Si un listener de status lanza durante connect, el catch libera el puerto, pero #port ya está asignado: connect rechaza y status puede seguir ready. Reproducido con un suscriptor que lanza Error. Debe revertirse estado y aislar callbacks externos.
3. Si cleanup lanza, dispose puede detenerse antes de limpiar recursos. Si port.dispose falla en el catch de connect puede ocultar el error original. La idempotencia probada es solo nominal. Se necesitan try/finally, causas de error preservadas y pruebas de rutas excepcionales.
4. La función reportEngineError solo cambia texto accesible: no silencia, suspende, invalida ni cambia el estado del facade. Actualmente no hay audio; no sería una política de seguridad suficiente con engine.

**P1:** falta timeout/abort de initialize; dispose durante carga evita activar el puerto cuando la promesa resuelve, pero no cancela la carga. Una carga bloqueada puede permanecer pendiente. No hay descubrimiento de device, vigilancia de invalidación/fallo del procesador, recuperación, rechazo de mensajes de engines anteriores ni resuscripción tras reemplazo. Los listeners sin aislamiento también pueden interrumpir telemetría y notificaciones del store.

## 3. Contrato de telemetría propuesto — NO implementado

Este es un contrato de proyecto para aprobar, no una promesa de API RNBO. Adquisición, eventos de reloj/DATA, registro, realimentación, filtrado, decimación antialias y FFT quedan en RNBO/gen~. JS solo valida y transporta paquetes, convierte coordenadas/unidades de presentación y dibuja; no usa timers de UI para avanzar estados DSP. No se propone AnalyserNode para calcular el espectro en JS.

### 3.1 Sobre común y reloj

Cada paquete lógico:

`{schemaVersion:1, source:'engine', engineInstanceId, epoch, stageId, streamId, sequence, captureId, configRevision, sampleRateHz, firstSample, sampleCount, strideSamples, emittedAtSample, status, units, payload}`.

- Nombres nuevos de esta propuesta, no IDs RNBO existentes. Un manifest debe fijar streamId, nodos/puntos de toma y capacidades por etapa.
- sampleRateHz es la tasa real del contexto/DSP; firstSample es entero de muestras desde epoch. Tiempo de la muestra i: (firstSample+i·strideSamples)/sampleRateHz. sampleCount es número de observaciones; stride explícito solo para señales uniformes.
- Para datos por eventos o bins FFT, strideSamples=null y el payload declara offsets temporales o ejes espectrales. No asignar tiempo uniforme a eventos irregulares.
- emittedAtSample y los tiempos del registro se asignan en el DSP. No derivar adquisición de Date.now, requestAnimationFrame o instante de llegada. Si se transporta tiempo RNBO en ms, el puerto lo convierte con origen explícito; no confundirlo con AudioContext.currentTime en segundos.
- epoch cambia al reiniciar estado/recrear engine/cambiar origen temporal. engineInstanceId distingue instancias y sus mensajes tardíos. sequence crece por stream; captureId vincula capturas realmente comunes; configRevision referencia cambios efectivos en DSP.
- status: valid, warming-up, unavailable, suspended o error. Con status no válido, payload=null y reason obligatorio. Los nombres no están presentes todavía en el facade.
- units identifica cada canal; no rotular voltios por analogía. CV digital usa unidad adimensional normalizada declarada, o V-equivalent solo si se aprueba una conversión explícita. Audio: amplitud digital con 1.0 como referencia de pico, no SPL.
- Validar versión, etapa, engine/epoch, secuencia, longitudes, finitud, límites, canales y metadatos antes de dibujar. Rechazar duplicados, orden antiguo y arrays desmesurados. No aplicar clamp silencioso a medidas fuera de escala: señalarlas.

### 3.2 Streams y política de actualización

Los límites siguientes son presupuestos iniciales propuestos para UI, no garantías del export ni tasas de simulación. Separar adquisición de refresco; el procesamiento continúa a su tasa DSP.

| Vista | Fuente y payload | Unidades / adquisición | Publicación y sincronía propuestas |
|---|---|---|---|
| Osciloscopio de audio | Punto explícito de salida de etapa, después de su ganancia interna y antes del mute/master de seguridad. Float32Array por canal; captura contigua, 1024 muestras iniciales. | Amplitud digital; tiempos en s derivados de Fs real; stride=1. Sin normalización automática que oculte cambios de amplitud. Registrar mute/master aparte. | Hasta 30 paquetes/s. Ventanas independientes pueden dejar intervalos sin mostrar; no presentarlas como registro continuo. Trigger opcional calculado en RNBO/gen~ y marcado con sample offset. |
| Monitor CV | Nodos identificados: p.ej. salida DAC, CV hacia FM A/B y salida S&H, solo si existen en la etapa. Valores y/o pares min/max por bucket calculados en DSP. | Adimensional normalizada con rango nominal explícito; Hz/octavas solo después de aprobar conversión. Para continuo: filtrado/decimación DSP con tasa efectiva y stride; para S&H: eventos con sample offsets y hold explícito. | Hasta 30 paquetes/s. Un snapshot de último valor no sirve para estudiar transiciones rápidas. Envolvente conserva extremos, no la forma exacta; marcar modo envelope/events/samples. |
| Espectro | Mismo punto de audio que el scope. FFT, ventana, normalización y promedio en RNBO. Payload de amplitudes dBFS y metadatos. | Propuesta: N=2048, hop=512, ventana Hann periódica; bins 0…N/2, f[k]=k·Fs/N. Espectro de amplitud unilateral de pico, no PSD ni RMS. | Hasta 20 paquetes/s seleccionando resultados completos de FFT, sin cambiar su hop DSP. Tiempo = comienzo y centro de ventana; ventana y latencia declaradas. Comparar solo ventanas/condiciones compatibles. |
| XY | Dos señales explícitas tomadas en el mismo engine/bloque. Float32Array x/y de igual longitud; captura inicial de 1024 pares. | Unidad de cada eje declarada; mismo firstSample, stride y filtrado/retardo alineado. No unir dos streams según hora de llegada. | Hasta 30 paquetes/s; captureId común y sin interpolación temporal inventada. Un retrato XY no es por sí mismo una reconstrucción del espacio de estados. |
| Registro digital | Evento atómico RNBO/gen~ después de cada flanco activo: bitsBefore, bitsAfter, bitCount, shiftDirection, bitOrder, dataIn, clockSource, clockEdge, edgeSample, taps, dacCode y dacValue, cuando corresponda. | Bits {0,1}, código entero, DAC adimensional según mapa definido. Longitud/taps/pesos no se fijan por la ilustración. No asumir 8 bits por el dibujo de referencia. | Emitir/batchear transiciones con timestamp DSP. Refresco de panel ≤30/s, reteniendo orden en buffer acotado. Si desborda: contador de pérdidas y discontinuidad; nunca inventar transiciones. Modo de estudio lento para seguir cada evento. |

Normalización espectral propuesta: w[n]=0.5−0.5·cos(2πn/N); A[k]=2·|X[k]|/sum(w) en bins interiores y |X[k]|/sum(w) en DC/Nyquist. RNBO calcula 20·log10(max(A,10^-8)), con suelo de visualización −160 dBFS. Esto fija una referencia de amplitud para senos centrados en bins; no elimina fuga espectral ni equivale a densidad espectral o energía RMS. Cualquier promedio debe declarar dominio, número de ventanas/tiempo e inicialización. Validar con señales de calibración antes de usarlo didácticamente. RNBO dispone de FFT con ventanas; la elección y calibración aquí son propuestas del proyecto. [Using the FFT](https://rnbo.cycling74.com/learn/using-the-fft).

### 3.3 Transporte, límites y datos ausentes

- El futuro puerto traduce outports/messageEvent u otro mecanismo soportado y verificado para el export. Un paquete lógico puede fragmentarse en chunks acotados con frameId/chunkIndex/chunkCount y publicarse solo al completarse. No suponer transporte nativo de estos objetos/TypedArrays por RNBO, acceso zero-copy a buffers ni lecturas atómicas sin verificarlo.
- Para curvas: cola acotada de dos frames completos por stream, latest-wins para visualización; contabilizar descartes. Para registro: ring buffer propuesto de 4096 eventos y overflow explícito. Son capacidades iniciales revisables tras medir carga. No bloquear el hilo de audio esperando a Canvas.
- Un paquete espectral 1025×Float32 a 20/s implica unos 82 kB/s de valores sin contar overhead. Medir coste de serialización y transporte real; los outports no se deben inundar con un mensaje por muestra.
- Render Canvas como máximo 30 fps; al ocultar página, detener pintura y reducir/desactivar captura visual, sin cambiar la dinámica DSP. Una sesión de registro experimental completa sería otra función, no debe depender de la cola latest-wins.
- Invalidar datos al cambiar etapa/epoch. Para streams continuos, proponer stale después de max(500 ms, 3 periodos de publicación). Para registro, ausencia de flancos es legítima: heartbeat cada 250 ms con último edgeSample, contador de eventos y clock-running, para distinguir reposo de desconexión.
- Sin datos: mostrar NO DATA; ante suspensión: SUSPENDED; pérdida/orden inválido: GAP; captura anterior retenida: STALE con edad. Limpiar o congelar marcado, nunca mostrar cero como dato recibido. Antes de completar N muestras FFT: WARMING UP. Nunca sustituir automáticamente por GraphicDemo.
- Todos los streams necesitan declarar puntos pre/post-mute. Con esta propuesta se observan señales internas pre-mute aunque la salida esté silenciada; mostrar ese estado para evitar interpretar silencio de altavoz como señal DSP nula.

## 4. Estado, ciclo de vida y reproducibilidad

### 4.1 Estado actual

Persistencia independiente de **valores de controles** en un único ParameterStore durante la sesión. Cambiar etapa elimina controles anteriores y sus suscripciones; los cuatro Canvas y su ResizeObserver se reutilizan. Hay una suscripción global al store y un scheduler de dibujos, no uno nuevo por etapa. Pagehide no persistente limpia observers, controles y listeners; BFCache conserva la instancia. No hay instrumentación de heap ni prueba de fugas de un RNBO Device real.

Reset this stage restaura valores de controles; no existe estado DSP que reiniciar y no hay comando resetDSP. Tampoco hay semillas, fases iniciales, bits iniciales, buffers internos o snapshots de experimento. GraphicDemo contiene senos/curvas deterministas de dibujo; phase avanza por frames renderizados y no es un reloj científico reproducible.

No hay AudioContext, engine, detección de audio-hardware ni política de suspensión ejecutándose. START AUDIO, MUTE, MASTER LEVEL y PANIC están disabled en HTML y sin listeners. El valor 0 de MASTER LEVEL es un atributo de esa UI, no un gain DSP efectivo. El puerto start/mute/masterLevel/panic es una preparación; no hay acción sonora implementada.

Riesgo de integración: los cambios de etapa preservan controles, no una instancia ni estados internos de cada DSP. No se ha elegido preservar/resetear/recrear esos estados. Las llamadas async pueden terminar fuera de orden. Al navegar atrás hasta hash vacío, la guarda de showStage conserva la etapa activa aunque la URL no la nombre: detalle de navegación pendiente, no un reset.

### 4.2 Política futura recomendada, no implementada

1. Estado supervisor explícito: unavailable → loading → ready-muted → running/suspended; error conduce a salida silenciada; disposed es terminal. Un solo AudioContext propietario compartido salvo necesidad demostrada.
2. Crear/reanudar desde START AUDIO bajo gesto explícito; inicializar puerto sin conexión audible, gain de seguridad a cero y mute activo. Validar versión, esquema, mappings y snapshot; después habilitar audio. Resume exige gesto según la guía oficial. [Working with Web Audio Contexts](https://rnbo.cycling74.com/learn/working-with-web-audio-contexts).
3. Separar tres operaciones: resetControls (valores por defecto), resetDSPState (fases, registro, memorias y PRNG según especificación) y restartExperiment (configuración + semilla + estado + origen temporal). No asumir que mute/suspend o cargar valores iniciales equivalen a reinicio.
4. En cambio de etapa: silenciar, bloquear/serializar comandos, cerrar epoch/capturas, retirar suscripciones del device saliente, aplicar política de estado explícita, confirmar activación y publicar nuevo epoch/revision. Después permitir reapertura gradual. Un canal viejo no debe actualizar la etapa nueva.
5. Mute cambia solo salida con rampa definida; no altera reloj/registro/filtros. MASTER LEVEL es ganancia final con límites y suavizado, sin confundirla con normalización de CV. Panic prioriza gain seguro a cero y cancela eventos pendientes; si falla DSP debe existir silencio independiente en el grafo host. El reset de estado asociado a panic debe documentarse, no suponerse.
6. Fallos de carga, WASM, parámetros, procesador o valores DSP no finitos: fail-closed, error visible, no reanudación automática audible. Definir clipping, límites y protección de amplitud en RNBO/gen~; el host puede cortar salida sin calcular dinámica. La UI no debe afirmar que está silenciada solo por cambiar texto.
7. Suspensión explícita detiene el procesamiento del contexto; mute no. No suspender automáticamente al perder foco durante un experimento sin anunciar la discontinuidad. Ocultar ventana detiene pintura; continuar/pausar DSP requiere política y registro. Al reanudar, verificar estado real y excluir mensajes viejos.
8. Teardown en try/finally: silencio, bajas, desconexión, liberación soportada por la versión concreta, aborto de cargas y cierre del contexto solo por su propietario. No inventar un Device.dispose() de RNBO por analogía con nuestro port.dispose; verificar API/runtime fijados y medir que se detenga el procesador.

### 4.3 Semillas y experimentos

No hay PRNG ni semilla implementados. Un PRNG futuro debe ejecutarse en RNBO/gen~, con algoritmo, versión, semilla y procedimiento de reseed definidos y validados para los objetos elegidos. No usar Math.random para DSP, semillas ocultas o reloj de UI como reloj de muestreo.

Registro experimental propuesto: hashes/versiones de export/runtime, topología y mappings; snapshot solicitado y efectivo; semilla/estado PRNG; fases, bits y memorias iniciales; Fs, vector size, retardos explícitos, precisión, suavizados; orden y sample index de comandos; warm-up, observables y duración; browser/plataforma y pérdidas de telemetría. Reiniciar reloj/seed sin restaurar estado completo no garantiza repetir la trayectoria. Repetibilidad local no implica igualdad bit a bit entre navegadores/targets. Para sensibilidad a condiciones iniciales, mantener semilla y resto de estado fijos y variar solo la perturbación declarada.

## 5. Compatibilidad oficial y despliegue RNBO propuesto

La separación UI/puerto es compatible como diseño, pero todavía no hay interoperabilidad comprobada. El contrato propio no es una copia de @rnbo/js. Este paquete será una **dependencia de ejecución necesaria** del futuro engine, aunque se mantenga la prohibición de librerías UI de terceros. Hoy package.json no tiene dependencias.

- El export Web requiere la biblioteca RNBO.js; npm proporciona @rnbo/js, y Cycling '74 advierte de desajustes entre versión de export y biblioteca. Recomendación: fijar la versión exacta compatible con el RNBO que exporta, no latest ni rangos con caret. No elegir número hasta inspeccionar ese export. [Getting the RNBO.js library](https://rnbo.cycling74.com/learn/getting-the-rnbojs-library).
- El puerto concreto cargará patcher local y usará la fábrica createDevice({context,patcher}); no construirá BaseDevice directamente. La página debe servirse por HTTP local/HTTPS público. No usar prevDevice como cambio genérico de etapa: esa vía invalida el anterior y requiere un caso de uso específico. [Loading a RNBO Device](https://rnbo.cycling74.com/learn/loading-a-rnbo-device-in-the-browser-js), [createDevice](https://rnbo.cycling74.com/js/ref/js/createDevice).
- Vincular IDs UI estables mediante un manifest explícito a device.parametersById.get(rnboId). Comprobar existencia, min/max, iniciales y enumeraciones del export. Usar valores declarados o conversión explícita; no aplicar la normalización log UI otra vez sobre normalizedValue de RNBO. Para retorno, usar parameterChangeEvent/changeEvent y la política de notificaciones aprobada; mapear inversamente, actualizar store con source=engine y confirmar valores efectivos. Esto no existe hoy. [Getting and Setting Parameters](https://rnbo.cycling74.com/learn/getting-and-setting-parameters-js).
- Los metadatos exportados distinguen paramId, nombre visible, límites, pasos, unidades e iniciales; no identificar por displayName ni índice de array. [Export Description](https://rnbo.cycling74.com/learn/export-description).
- RNBO ofrece messageEvent/outports y scheduleEvent para mensajes; el puerto debe convertirlos al contrato de proyecto. No asumir que una notificación recibida en JS fija el momento DSP del evento. [Sending and Receiving Messages](https://rnbo.cycling74.com/learn/sending-and-receiving-messages-inlets-outlets).
- EventSubject.subscribe devuelve un IEventSubscription con unsubscribe(), mientras nuestro puerto exige una función: el wrapper debe devolver una closure que llame a unsubscribe, no pasar directamente el objeto RNBO. [IEventSubscription](https://rnbo.cycling74.com/js/ref/js/IEventSubscription).
- Para retornos dependientes de muestras, gen~ dentro de RNBO permite procesamiento de feedback de una muestra; feedback~ puede introducir un vector de retardo. Elegirlo altera el modelo, no es un detalle de UI. Exposición/nombres de parámetros Gen deben comprobarse en el export, usando nombres estables y min/max explícitos. [Gen in RNBO](https://rnbo.cycling74.com/learn/gen-rnbo).

Estrategia sin CDN en ejecución, **solo recomendada**: instalar @rnbo/js@VERSION-EXACTA al integrar, conservar lockfile y licencias, y generar un bundle local reproducible del engine-port con un empaquetador de desarrollo pequeño y fijado (p.ej. esbuild, pendiente de comprobar el paquete real). Mantener UI en módulos nativos. Publicar bundle, worklet/WASM y dependencias de archivos requeridas por esa versión bajo rutas relativas locales. Verificar la salida real del paquete; no asumir nombres/copias arbitrarios de archivos internos. El build es una herramienta de desarrollo, @rnbo/js sigue siendo una dependencia runtime aunque vaya empaquetada.

Añadir manifest de versión de Max/RNBO de exportación, runtime, hashes de export/bundle/recursos, esquema UI, mapping y protocolo de telemetría; no editar metadatos internos del export para forzar compatibilidad. Probar carga sin solicitudes a dominios externos y con caché limpia; comprobar MIME y rutas en el prefijo GitHub Pages. Sin cambios de hosting salvo una necesidad demostrada. No introducir SharedArrayBuffer como requisito: el transporte inicial debe funcionar sin asumir headers COOP/COEP.

La documentación consultada incluye páginas con selectores de versión y diferencias de nomenclatura en ejemplos. La referencia final será la API/tipos del @rnbo/js exacto del export. Estas consultas no validan todavía una pareja export/runtime concreta.

## 6. Revisión científica por etapa

Estas son exigencias de definición del modelo didáctico, no de fidelidad circuital ni resultados científicos nuevos.

**0A / Continuous noise.** Variation rate en Hz no está operacionalmente definida. Ruido blanco discreto no tiene una única frecuencia de variación ajustable distinta de Fs; su síntesis digital tiene PRNG/estado. Si se desea ruido filtrado, definir tasa como frecuencia de corte con filtro/orden/normalización concretos; si es tasa de actualización de valores aleatorios, se introduce sample-and-hold y se confunde con 0B; si es inversa de tiempo de correlación, definir proceso y convención. No elegir entre esas opciones sin revisión. No atribuir al control actual ninguna de ellas. Definir distribución, ancho de banda, estacionariedad, amplitud, offset y polaridad. El texto de portada “without an explicit stored state” debe acotarse a ausencia del registro/retención visibles: un generador digital y un filtro pueden tener estado interno. No se edita la portada.

**0B / Clocked sample & hold.** Definir qué señal se muestrea, a qué tasa se genera, flanco, simultaneidad DATA/CLOCK, hold y estado inicial. Separar PRNG subyacente de muestreo. Regularizar tiempos de muestreo no hace deterministas los valores aleatorios. El cuantizador exige mapa de altura, referencia, tónica, temperamento, rango y redondeo; nombres de escalas no bastan. Cuantización de UI no equivale a cuantización musical del DSP.

**1 / Core Rungler.** Especificar grafo exacto A/B→CLOCK/DATA, polaridad/flanco, conversión a bit, dirección/longitud de registro, taps y pesos DAC, estado inicial y ley de FM con saturación y retardo. Si se selecciona B como clock, decidir si DATA cambia a A o qué alternativa es válida; actualmente no hay dataSource. La ausencia de controles de bits/taps no permite inventar su valor. Frecuencias de UI son base solicitada, no frecuencia instantánea bajo realimentación. Definir feedback ON/OFF y latencias de una muestra frente a bloque. No se deduce determinismo físico o caos a partir de feedback o irregularidad visual.

**2 / PWM.** Definir señales comparadas, umbrales, signo, duty cycle nominal frente a duty resultante, interacción con modDepth/invert y amplitud de salida. Establecer tratamiento de discontinuidades/aliasing y punto de observación. Cambiar un comparador puede alterar solo salida audible o entrar en feedback; hay que fijar esa topología. “Acoustic generation” no debe implicar modelo acústico: sería generación de señal de audio.

**3 / Exciter & resonator.** Definir una arquitectura funcional inspirada en Twin Peak, sus nodos, acoplamientos, entrada/salida y estados. Decidir qué significan peakA/B y cómo resonance se relaciona con amortiguamiento/ganancia; no etiquetarla Q sin fórmula. Precisar estabilidad, autooscilación si procede, energía del excitador y normalización. “Vocal-like” puede ser descripción perceptiva, no prueba de formantes ni equivalencia física. Evitar que un espectro ilustrativo parezca una medición de esa respuesta.

**4 / Blippoo-inspired architecture.** Definir los dos subsistemas y qué distingue “A/B” de VCO A/B internos; fijar todas las aristas, signos, retardos y estados compartidos. Precisar couplingAB/BA, crossFeedback, balance y Combined; las etiquetas no establecen un grafo. No asumir que dos bloques Rungler genéricos bastan para reproducir una arquitectura concreta ni exigir reproducción exacta de hardware.

**Determinismo, bifurcaciones y caos.** Determinismo significa mismo estado completo e inputs/eventos → misma evolución del modelo especificado, no regularidad aparente. Un PRNG con semilla puede ser determinista sin ser una fuente física estocástica. Un registro binario autónomo finito y determinista acaba en una órbita periódica, pero eso no caracteriza por sí solo un sistema híbrido con osciladores y feedback. Una curva XY atractiva, espectro ancho o sensibilidad aparente no prueban caos ni reconstruyen el estado completo. Para afirmar bifurcación hay que definir familia de modelos, parámetro barrido, estado/transitorios, observable, protocolo de barrido/continuación y convergencia. Para afirmar caos se requiere evidencia apropiada al modelo (p.ej. sensibilidad cuantificada y estimación de exponentes con método validado), excluyendo ruido, aliasing, cuantización, retardo de bloque y artefactos numéricos. Ninguna de esas pruebas existe hoy. No llamar “resultados” a los dibujos de GraphicDemo.

## 7. Recomendaciones priorizadas y verificación

**P0 — antes de implementar/conectar engine:** aprobar significado de 0A.rate y leyes/unidades/topologías; cerrar contrato de IDs/mapping e inicialización, retorno de valores y timing; corregir validación de propiedades heredadas, rollback de connect y cleanup excepcional; definir supervisor y silencio independiente, mute/master/panic; revisar protocolo de telemetría sin inferir capacidad del export.

**P1 — primera integración acotada, solo tras autorización:** escoger un export de una etapa, fijar @rnbo/js compatible y recursos locales; handshake de metadatos/snapshot y actualización bidireccional; serialización de cambios de etapa/comandos, epoch y revisión; calibración de streams, pérdidas, seeds y reset de estado; pruebas de error e invalidación, carga/salida silenciosa y uso real de recursos.

**P2 — antes de workshop/publicación funcional:** verificar móvil táctil y Safari/Firefox, carga/latencia, límites de telemetría, accesibilidad, presets/registro reproducible y protocolo científico; corregir detalle de ruta vacía; validar campus independientemente. No ampliar algoritmos ni publicar por el hecho de completar esta auditoría.

Verificación en esta fase documental: inventario importado del módulo real; dos sondas en memoria reproducen los hallazgos de ID heredado y estado ready tras fallo de listener; suite existente npm test (8/8), npm run check (12 scripts/módulos) y git diff --check. Las pruebas existentes no cubren los dos fallos hallados ni validan DSP, RNBO real, memoria o telemetría. No se añaden ni alteran tests en esta fase. Se comparan SHA-256 de todos los archivos previos para confirmar que únicamente se añade este documento. Sin commit ni push; a la espera de evaluación de ChatGPT y autorización expresa.

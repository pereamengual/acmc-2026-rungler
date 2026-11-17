# ACMC 2026 Rungler — Phase 1.2 hardening report

Fecha: 27 de octubre de 2026. Alcance: validación, almacén, contrato de transporte, suscripciones y documentación. Sin engine, audio, RNBO, dependencias nuevas o cambios topológicos. Desarrollo detenido al concluir esta entrega, pendiente de revisión de ChatGPT y autorización expresa.

## 1. Defectos corregidos y causas

| Defecto anterior | Causa | Corrección y evidencia |
|---|---|---|
| IDs heredados como constructor llegaban al puerto con NaN | Lookup mediante truthiness sobre un objeto con prototipo | getParameter exige string y Object.hasOwn; store/adapter comparten ese lookup. Pruebas de constructor, __proto__, toString, hasOwnProperty, desconocidos y no strings; cero envíos inválidos. |
| Valores no finitos podían propagarse desde rutas no suficientemente protegidas | Se confiaba en el descriptor o normalización sin guardas completas | Guardas de números finitos en requests, normalización y resultado cuantizado; snapshots propios completos antes de encolar. Confirmaciones se validan aparte, sin recorte silencioso. |
| Un listener que lanzaba durante connect dejaba ready con un puerto liberado | Emisión de eventos dentro del bloque transaccional sin aislamiento | SafeListeners contiene excepciones síncronas y promesas rechazadas; no cambian el resultado de conexión ni impiden otros listeners. La cancelación reentrante sí se reconoce y no resucita la conexión. |
| Rollback parcial durante setup de suscripciones | No se registraban/liberaban individualmente todos los handles | Registro de bajas adquiridas, baja inversa y port.dispose en finally. Fallos de initialize o suscripción eliminan referencia y dejan error, salvo si ya disposed. |
| Errores de cleanup ocultaban el fallo original o interrumpían liberaciones | await secuenciales sin colección de errores ni finally | Se intentan todas las bajas y dispose una vez; se recogen errores secundarios. Connect/write rechazan con la misma excepción original. Explicit dispose informa AggregateError y limpia referencias en finally. |
| Llamadas async sin orden ni protección generacional | Cada método enviaba inmediatamente y no había identidad/revisión | FIFO por conexión para setStage/setParameter/command; connectionId, stageRevision y requestId. Callbacks viejos y revisiones anteriores no se aceptan. |
| Dispose podía competir con initialize o un envío | No existía una barrera común de vaciado | Dispose invalida síncronamente, solicita abort, cancela cola pendiente y espera inicialización/trabajo ya iniciado antes de liberar; una promesa compartida impide doble cleanup. |
| No había separación efectiva entre solicitud UI y observación del engine | Un único estado de valores y solo un punto source=engine preparatorio | Store conserva solicitados y confirmados separados, con procedencia/revisión/secuencia. Se prepara la ruta explícita de confirmaciones; no se genera ninguna por resolver un envío. |

Los límites, pasos, redondeos y comportamiento discreto de los controles se conservan. Se mantienen los 27 IDs estables, rangos, iniciales, unidades, escalados y opciones. Una comparación programática con el registro inicial detecta una sola diferencia de parámetro: label de 0A.rate, de Variation rate a Noise bandwidth. Solo cambia además la descripción didáctica de 0A; no las otras cinco etapas.

## 2. Archivos modificados en esta fase

Modificados respecto al inicio de Phase 1.2 (comparación SHA-256; no confundir con todo el trabajo sin commit de Phase 1):

- `lab/js/core/parameters.js`: lookup propio, validación de confirmaciones/normalización, guardas y descripción/etiqueta de 0A.
- `lab/js/core/store.js`: listeners aislados y estado de confirmaciones separado.
- `lab/js/adapters/rnbo-adapter.js`: ciclo de vida, rollback, FIFO, cancelación y puerto v2.
- `lab/js/main.js`: puente preparatorio de confirmaciones, diagnóstico y captura de errores de dispose.
- `lab/index.html`: etiqueta REQUESTED UI VALUES; sin cambios de estilo ni controles de audio activos.
- `tests/adapter.test.js`: suite de transporte y concurrencia ampliada.
- `tests/parameters.test.js`: regresiones de validación, suscriptores, confirmaciones y 0A.
- `docs/architecture.md`: contrato actual completo, límites y supervisor futuro.

Nuevos:

- `lab/js/core/subscriptions.js`: SafeListeners y diagnóstico aislado.
- `tests/fake-port.js`: puertos de transporte simulados y promesas controlables; no simulador RNBO/DSP.
- `docs/phase-1-hardening-report.md`: este informe.

Sin cambios en esta fase: componentes controls.js/plots.js, graphic-demo.js, lab.css, portada y su CSS/JS, package.json, .nojekyll, fuentes, herramientas de desarrollo, AGENTS.md, informe original y auditoría de Phase 1.1. Estos últimos documentos conservan el estado histórico anterior; la descripción contractual actual está en architecture.md.

## 3. Pruebas y resultados

### Automatización

- `npm test`: **26/26 pasan** (18 pruebas del adaptador, 8 del registro/almacén/demo). Sin pruebas omitidas, canceladas o pendientes.
- `npm run check`: **14 scripts/módulos JS con sintaxis válida**.
- `git diff --check`: correcto.
- Comparación programática del registro: ninguna modificación de IDs o metadatos numéricos; solo label de 0A.rate.
- Comparación SHA-256 de archivos respecto al inicio: únicamente la lista anterior y los archivos nuevos indicados.

Cobertura de transporte (solo fakes):

1. Métodos offline, validación del puerto v2 y callbacks no válidos.
2. IDs heredados/desconocidos y NaN, ±Infinity, cadenas, booleanos, null/undefined: no llegan al puerto.
3. Límites, cuantización discreta, redondeo y snapshot capturado antes de mutación externa.
4. Listeners que lanzan o rechazan promesas sin romper connect ni otros suscriptores.
5. Fallo de initialize con fallo secundario de dispose: rollback y excepción original preservada.
6. Fallo parcial de setup de suscripciones: bajas adquiridas liberadas.
7. Fallos de unsubscribe/dispose: todos se intentan; AggregateError; idempotencia/rechazo posterior a dispose.
8. Orden FIFO de setStage, setParameter y command con una operación bloqueada controlablemente.
9. Dispose durante trabajo iniciado: invalidación inmediata, cancelación de pendientes y liberación tras el vaciado.
10. Dispose durante initialize: AbortSignal, resolución tardía sin ready y un solo dispose.
11. Cambios rápidos por las seis etapas: orden de snapshots/revisiones y descarte de callbacks antiguos.
12. Fallo de escritura seguido de conexión nueva: mensajes de la anterior no afectan a la nueva.
13. Confirmación explícita, finita, válida y monótona: sin fabricar acknowledgement por resolver una promesa.
14. Dispose reentrante desde observers de loading o ready.
15. Suscriptores reentrantes no alteran el orden de etapas aceptadas.
16. Fallo de operación y de cleanup con trabajo en cola: original preservado, pendientes cancelados.
17. Reintento bloqueado mientras termina el cleanup anterior.
18. Reintento disparado desde el evento error: la cola vieja no modifica la conexión nueva.

Pruebas del registro/almacén: invariantes de las seis etapas/27 IDs, log/normalización, persistencia independiente y reset, coordenadas ilustrativas acotadas; rechazo de IDs/valores inválidos sin mutación; aislamiento de callbacks sync/async y diagnóstico que falla; separación/invalidez de confirmaciones; ID/rango de 0A sin cambios y memoria descrita correctamente.

### Navegador local (Chrome)

- Las seis rutas muestran sus etapas.
- Valores de knob y switch sobreviven a la navegación; Reset this stage vuelve a sus iniciales.
- Selector nativo Scale selecciona Dorian.
- Teclado: End/ArrowRight en Noise bandwidth y Space en switch.
- Ratón: arrastre del dial SVG cambia el valor mostrado; reset posterior restaura 1 Hz.
- Demo gráfica on/off conserva su aviso simulado y sin audio.
- Las seis etapas a viewport 390×844: sin desbordamiento horizontal.
- Los cuatro controles globales permanecen disabled.
- Sin errores/warnings en la consola de la página durante la comprobación.
- Estética y componentes conservados; captura local de evidencia en `/private/tmp/acmc-phase-1-hardening.jpg` (fuera del checkout).

No se declara prueba física de touch, validación Safari/Firefox, perfil de heap ni integración RNBO/audio.

## 4. API final y cambios de contrato

### Estado y significado

RNBOAdapter solo implementa estados de **transporte**:

`unavailable`, `loading`, `ready`, `error`, `disposed`.

Ready significa inicialización del puerto, no ejecución sonora, silencio verificado o AudioContext activo. Los estados futuros del supervisor de audio están documentados separadamente: unavailable, loading, ready-muted, running, suspended, error, disposed. No se emiten estados running/suspended/ready-muted en esta fase. No hay AudioContext.

### API pública del adaptador

- `new RNBOAdapter({onDiagnostic}={})`.
- `status`, `connectionId` (getters).
- `connect(port)` -> Promise<void>.
- `setStage(stageId,snapshot)` -> Promise<boolean>.
- `setParameter(uiId,value)` -> Promise<boolean>.
- `command(name,value?)` -> Promise<boolean>.
- `subscribe(listener)` -> función de baja.
- `dispose()` -> promesa compartida Promise<void>.

Offline/loading/error: requests válidos devuelven false, sin cola ni confirmación. Requests inválidos rechazan. Después de dispose, operaciones válidas y nuevas suscripciones rechazan. Connect duplicado o durante cleanup rechaza. Tras fallo retirado se permite una nueva conexión; disposed es terminal.

setStage captura/valida todos sus campos propios; parámetros extra se ignoran. setParameter conserva el dominio del registro y sus pasos; no aplica mapping RNBO ni comprueba pertenencia al stage actual. command valida mute boolean, masterLevel finito 0…1 y start/panic sin payload.

### Puerto propio v2

```
contractVersion: 2
initialize({connectionId, signal})
setStage(stageId, snapshot, context)
setParameter(uiId, value, context)
command(name, valueOrUndefined, context)
subscribeTelemetry(callback) -> cleanup
subscribeParameterChanges(callback) -> cleanup  // opcional
dispose()
```

`context = {connectionId, stageRevision, requestId}` congelado. Stage snapshots también congelados. IDs/revisiones son de transporte, no tiempo DSP ni IDs RNBO.

Cambio incompatible explícito de v1 a v2: nuevas garantías de contexto, sobres de callbacks y cancelación cooperativa. Se rechaza v1. Esto afecta únicamente a puertos de prueba/preparación; no existía un device RNBO operativo que migrar.

Confirmaciones del puerto: `{id,value,stageRevision,sequence}`. Solo se aceptan valores de la conexión/revisión/etapa actuales y secuencias enteras seguras crecientes por parámetro. Los valores reales de knob no se cuantizan al paso UI; fuera de rango o no finitos se rechazan. Switches/selectores confirmados deben ser enteros. Telemetría: `{stageRevision,payload}`; se filtra procedencia/revisión pero el payload científico sigue opaco.

Eventos facade:

- `status` con status, connectionId y stageRevision; en error incluye error original y cleanupErrors.
- `stage-requested` con stageId y context; no declara activación efectiva.
- `parameter-confirmed` con id/value, connectionId/stageRevision/sequence.
- `telemetry` con connectionId/stageRevision/payload.

Los listeners están aislados; fallos se remiten a `onDiagnostic({error,phase})` sin romper otras notificaciones. Sin hook, no hay log implícito; por eso main conecta un anuncio accesible y las pruebas recopilan diagnósticos. El hook también está aislado.

### Orden garantizado

`setStage` → `setParameter` → `command` siguen orden de llamada FIFO y no solapan métodos del puerto. Un cambio rápido no elimina stages aceptados: cada uno se envía en orden. Las observaciones viejas se descartan al solicitar una revisión nueva.

Dispose cambia estado e invalida callbacks inmediatamente. No inicia trabajo pendiente; espera a que initialize y la operación ya invocada se resuelvan/rechacen antes de retirar suscripciones y liberar. Una operación ya enviada no se puede deshacer, pero su resultado tardío no se declara éxito tras dispose. Pendientes/rechazos por invalidación usan AbortError.

Cleanup intenta todas las bajas en orden inverso y siempre port.dispose, una vez por conexión. En fallo de connect/write se conserva la misma excepción original; secundarios en diagnósticos/status. Dispose explícito agrega fallos de cleanup y conserva su promesa rechazada para llamadas repetidas. Si un fallo anterior ya retiró la conexión, dispose no reintenta esa liberación ni oculta el fallo previamente notificado.

### Valores solicitados y confirmados

ParameterStore mantiene get/set/snapshot/reset/subscribe como API de solicitudes. Se añaden:

- `setConfirmationContext(context|null)`.
- `confirm(message)` -> boolean.
- `getConfirmed(id)` -> registro congelado o null.
- `subscribeConfirmed(listener)` -> baja.

Confirmar no cambia get(), no emite otra solicitud y no implica que sea respuesta al último requestId: es la última observación válida del engine. El mismo valor puede estar solicitado y no confirmado. Resolver setParameter/setStage no crea ninguna confirmación. Cambiar contexto/etapa invalida confirmaciones. Reset controles no resetea estado DSP ni inventa una confirmación nueva.

Main prepara el puente status/stage-requested/parameter-confirmed, pero no conecta ningún puerto: no llegan confirmaciones reales ni se presenta una respuesta de un RNBO inexistente. Una futura política de hidratación, mapping y visualización de confirmados debe revisarse con el export.

## 5. Revisión científica de 0A

0A.rate conserva ID, mínimo 0.05, máximo 30, inicial 1, unidad Hz, escalado log y paso 0.01. Nombre visible Noise bandwidth; interpretación prevista: frecuencia de corte de paso bajo. No se implementa filtro, generador, PRNG ni DSP. Deben aprobarse aún orden/respuesta/convenio de corte; no se identifica el control con ancho de banda equivalente de ruido (ENBW).

La descripción de 0A ahora distingue ausencia de sample-and-hold explícito de ausencia de memoria: el futuro ruido digital y el filtro pueden tener estado. Las ilustraciones siguen siendo dibujos sin significado experimental; el primer knob sigue afectando solo a su tamaño.

## 6. Límites y defectos pendientes

- Cancelación **cooperativa**: una operación/initialize que no termine puede mantener dispose pendiente. El orden evita liberar un puerto mientras sigue ejecutando un método; no se ha añadido timeout ni terminación forzada. El primer puerto real necesitará abort/deadline/terminación del procesador comprobados.
- Un unsubscribe/dispose que falla se informa y no evita las otras liberaciones ni deja estado ready, pero el facade no puede garantizar que un recurso externo defectuoso se haya liberado materialmente. Tampoco puede retirar una suscripción que el puerto creó y perdió antes de devolver handle: el puerto debe implementar su rollback interno.
- PANIC es hoy un nombre de comando preparado, en la misma FIFO; no tiene prioridad ni puede garantizar silencio. Antes de audio hace falta un camino de silencio host independiente y supervisor probado.
- No hay mapping RNBO, package/runtime, snapshots DSP, reloj de aplicación por muestras, hidratación inicial, respuestas de un device real ni validación de los cinco streams científicos. Port v2 debe implementarse y probarse contra una exportación concreta.
- No se implementa resetDSPState: sigue siendo una operación futura e independiente de resetControls; fases, bits, filtros y PRNG requieren especificación. No se cambia topología ni semilla alguna.
- La UI muestra solicitudes; el almacén dispone de confirmaciones separadas pero aún no hay presentación/hidratación de un device real ni acknowledgement correlacionado por requestId.
- Las decisiones científicas restantes de las etapas, definición precisa del filtro de 0A y calibración de telemetría siguen pendientes de revisión.
- Sigue pendiente el detalle histórico de ruta sin hash, pruebas táctiles físicas, otros navegadores y perfilado real de recursos. No se amplía esta fase para resolverlo.

Evaluación: los defectos críticos confirmados del transporte tienen correcciones y pruebas de regresión. Es una base revisable para desarrollar posteriormente un primer puerto real, no una certificación de interoperabilidad RNBO ni autorización para habilitar audio. Corresponde a ChatGPT revisar los cambios y los límites anteriores antes de autorizar la siguiente fase.

## 7. Git y publicación

Antes y después de esta fase:

- HEAD: `bc15ecaeb50a831f3aa2756124d44720d77b4efd`.
- Referencia local origin/main: `bc15ecaeb50a831f3aa2756124d44720d77b4efd`.
- Rama main, origin `https://github.com/pereamengual/acmc-2026-rungler.git` sin cambios.
- No se ejecutó git add, commit, push, fetch, herramientas de publicación ni instalación de paquetes.
- No se modificaron package.json, .nojekyll ni configuración de GitHub Pages.

Estado Git: README.md e index.html ya figuraban modificados desde Phase 1; AGENTS.md, docs/, lab/, package.json, tests/ y tools/ ya figuraban sin seguimiento. El estado sigue sin staging, incorporando los cambios locales de esta fase dentro de esas carpetas. La comparación SHA-256 con el inicio identifica exactamente qué archivos pertenecen a este hardening.

No se consultó el estado remoto del servidor ni se afirma que otra persona no lo haya cambiado: las referencias indicadas son locales y permanecen idénticas. No se realizó commit ni push desde esta sesión. Desarrollo detenido a la espera de revisión.

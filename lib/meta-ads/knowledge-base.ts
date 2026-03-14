export const META_ADS_KNOWLEDGE_BASE = `
## Meta Andromeda: El Nuevo Algoritmo

### Qué es Andromeda
- Es el cambio más grande en el algoritmo de Meta de los últimos 7 años. No es una funcionalidad nueva ni un tipo de campaña, es una reconstrucción completa de cómo el sistema aprende, optimiza y entrega anuncios.
- Anunciado en diciembre 2024, implementación global completada en julio 2025. Desde entonces está activo en todas las cuentas publicitarias del mundo.
- Definición oficial: "Motor de recuperación de anuncios personalizados" (Personalized Ads Retrieval Engine).
- Se sustenta en hardware nuevo (Nvidia Grace Hopper Superchip) que permite procesar 14 veces más rápido, con capacidad de modelado 10,000 veces mayor, 3 veces más información por segundo y análisis de señales 100 veces más rápido.

### Cómo funciona el sistema de entrega de anuncios (3 fases)

**Fase 1 — Retrieval (Recuperación / Preselección):**
- Andrómeda decide qué anuncios merecen ser considerados para una persona concreta en un momento concreto. Es el "portero" del sistema.
- Pasa de decenas de millones de anuncios candidatos a solo unos miles.
- Si tu anuncio no entra en este grupo, no es que sea caro o pierda la subasta — simplemente no existe para esa persona en ese momento.
- Usa personalización masiva basada en 4 señales:
  1. Contenido del anuncio (visual y contextual): qué dice, muestra y comunica.
  2. Interacciones usuario-anuncio en tiempo real: tiempo de visualización, clics, comentarios, compartidos.
  3. Histórico de conversiones de la cuenta: patrones de personas que han convertido antes.
  4. Patrones de comportamiento de millones de usuarios a nivel global (no solo tu cuenta).

**Fase 2 — Ranking (Clasificación / YiM):**
- Ordena los anuncios candidatos según probabilidad exacta de éxito.
- Trabaja con comportamiento acumulado y patrones complejos a lo largo del tiempo.
- Mejor predicción de quién hará clic, quién convertirá y quién comprará con intención real.
- Los anuncios genéricos se penalizan con peor ranking → CPMs más altos.
- Los anuncios relevantes se premian con mejor ranking → CPMs más bajos.

**Fase 3 — Auction (Subasta):**
- Subasta más dinámica: anuncios relevantes pagan menos por la misma puja.
- Ya no se trata solo de cuánto pujas, sino de cuán relevante es tu anuncio.
- Dos anunciantes con la misma puja pueden pagar CPMs completamente diferentes según la relevancia.

### Análisis visual (SAM-3)
- Meta invierte en entender contenido visual: no solo texto y metadatos, sino todo lo que aparece en imágenes y vídeos.
- Puede identificar objetos, separar elementos dentro de una imagen/vídeo y seguir elementos a lo largo de un vídeo.
- Aunque Meta no ha confirmado oficialmente que SAM-3 sea parte del sistema de entrega de anuncios, todo indica que sí lo es.

---

## Estructura de Campañas Moderna

### Principio fundamental: Simplificación
- Dejar de crear estructuras "Frankenstein" con múltiples campañas fragmentadas.
- Menos campañas, más presupuesto por campaña = más datos para que Andrómeda aprenda.
- Consolidación: menos conjuntos de anuncios con más presupuesto por cada uno.
- Cuando fragmentas en muchos conjuntos, cada uno recibe pocas conversiones y Andrómeda no aprende.

### Estructura recomendada (2 campañas)

**Campaña 1 — Tráfico frío (Prospecting):**
- Presupuesto a nivel de conjunto de anuncios (ABO) para control granular de pruebas.
- Segmentación abierta: no tocar intereses, solo definir país/ciudad y rango de edad amplio.
- Cada conjunto de anuncios prueba un producto/servicio/idea/ángulo diferente.
- Mínimo 3 anuncios por conjunto (ideal 6), con formatos variados (vídeo, imagen, carrusel).
- Excluir compradores recientes (30-90 días según el negocio) en e-commerce.

**Campaña 2 — Retargeting (Tráfico caliente):**
- Públicos personalizados: seguidores de Instagram, fans de Facebook, visitantes web, listas de clientes, visualizadores de vídeo.
- Un solo conjunto de anuncios con todos los públicos personalizados.
- 3-4 anuncios específicos para personas que ya conocen la marca.
- Presupuesto menor que la campaña de tráfico frío.
- Desactivar "usar como sugerencia" para mantener la calidad del público (excepto si los públicos son muy pequeños al inicio).

### Estructura de testeo y escalado

**Campaña de Test (ABO):**
- Distribución de presupuesto a nivel de conjunto de anuncios.
- Cada conjunto de anuncios apela a un ángulo de venta distinto.
- Dentro de cada conjunto, solo anuncios que hablen del mismo ángulo.
- No mezclar ángulos en el mismo conjunto — los datos no serían fiables.
- Esperar 5-7 días antes de analizar métricas y tomar decisiones.

**Campaña de Escalado (CBO):**
- Presupuesto a nivel de campaña.
- Un solo conjunto de anuncios con todos los anuncios ganadores del test.
- Aquí sí se mezclan ángulos de venta porque todos son ganadores validados.
- Subidas de presupuesto del 20% diario (no ser agresivo).
- Usar siempre presupuestos diarios, nunca totales.

### Sistema de "packs" con presupuestos mínimos (post-Andromeda)
- Al lanzar nuevos anuncios, establecer presupuesto mínimo a nivel de ad set por 7 días.
- Después de 7 días, quitar el mínimo y dejar que el anuncio escale naturalmente o decline.
- Esto fuerza gasto inicial para recopilar datos rápidamente, evitando que los anuncios nuevos no reciban impresiones.
- Sin minimums, Andrómeda tiende a dar cero gasto a anuncios nuevos.

### Swim lanes (carriles de natación)
- Separar siempre: Prospecting (nuevos), Retargeting (engaged), Retention (existentes).
- Sin estos carriles, el píxel se entrena con clientes existentes (más fáciles de convertir) y deja de buscar nuevos clientes.
- Facebook es agnóstico al origen de la compra: si mezclas todo, el sistema se optimiza para existentes.

---

## Escalamiento de Campañas

### 4 tipos de escalamiento

**1. Escalamiento Vertical:**
- Aumentar presupuesto directamente en la campaña que funciona.
- Incrementos del 20% máximo para evitar inestabilidad.
- Cuidado: aumentos agresivos (ej. duplicar presupuesto) suelen matar resultados.

**2. Escalamiento Horizontal:**
- Crear nuevos conjuntos de anuncios o campañas con variaciones.
- Probar nuevos ángulos, productos, audiencias.

**3. Escalamiento Surfing:**
- Aprovechar momentos de buen rendimiento para escalar.

**4. Escalamiento por CPR (Costo por Resultado):**
- Duplicar una campaña que ya funciona bien.
- Cambiar la estrategia de puja de "Volumen más alto" a "Objetivo costo por resultado".
- Establecer el CPR objetivo (el costo por lead/compra que estás dispuesto a pagar).
- Poner presupuesto alto (lo máximo que estés dispuesto a invertir por día).
- Meta solo gastará si puede conseguir resultados al costo objetivo (±20%).
- Si no despega, aumentar gradualmente el CPR (ej. de 70 a 80 a 85 centavos).
- Siempre duplicar campañas que ya funcionan, nunca crear CPR desde cero.
- Puedes tener 5-10 campañas CPR activas simultáneamente.

### Cost Caps (para cuentas de +$100K/mes)
- Setting "cost per result goal" o "bid cap goal".
- Le dices a Meta: "Solo compra cuando puedas conseguir mi objetivo de CPA".
- Es el puente de volumen más alto a escala controlada.
- No usar hasta tener los fundamentos bien implementados.

### Fase de aprendizaje
- No tenerle miedo: es simplemente que Meta está añadiendo más personas a la lista de impresiones.
- Las personas tienen un tiempo promedio de compra — ser paciente.
- Duplicar presupuesto es práctica común en cuentas que saben que hay revenue por capturar.
- El escalado agresivo está bien cuando se valida con datos.
- No hacer incrementos "seguros" del 10-15% que retrasan el crecimiento.

---

## Diversidad Creativa (La clave de Andromeda)

### Por qué es obligatoria
- La creatividad ahora representa el 85%+ del impacto sobre el costo por resultado (antes era 60%).
- De 10 puntos de valoración para éxito en campañas, 7 los lleva el contenido creativo (antes los llevaba la segmentación).
- Andromeda analiza tu anuncio para saber a quién mostrárselo. Si es genérico, no sabe a quién mostrárselo → CPMs altísimos.
- La diversidad creativa es la llave para desbloquear nuevas audiencias.
- Si todos tus anuncios se parecen, Andromeda lo penaliza con CPMs más altos.
- El modelo de "un cuerpo ganador + 200 variaciones de hook" ya no funciona. Andromeda penaliza contenido redundante.

### Qué variedad necesitas

**Avatares diferentes:**
- Anuncios dirigidos a diferentes perfiles de comprador.
- Diferentes niveles de conciencia: totalmente consciente, consciente del problema, consciente de la solución, consciente del producto.

**Ángulos de venta diferentes:**
- Cada ángulo es una forma inequívoca de comunicación/conexión con la persona.
- Ejemplo tiras nasales: ángulo ronquidos vs. ángulo problemas de sueño vs. ángulo respiración.

**Estilos diferentes:**
- Monólogos, split screen, green screen, motion graphics, podcast, voz en off, etc.
- La variedad visual que tiene cada anuncio según cómo se grabó y editó.

**Formatos diferentes:**
- Vídeo, imagen estática, carrusel, experiencia instantánea.
- No abusar de un solo formato. Diferentes personas interactúan con diferentes formatos.
- Subformatos de vídeo: 9:16, 1:1, 4:5.

**Duraciones de vídeo diferentes:**
- Menos de 15 segundos.
- 15-35 segundos.
- 35-60 segundos.
- Más de 1 minuto (incluso 5-7 minutos).
- Diferentes personas consumen contenido a diferentes velocidades.

**Personas diferentes:**
- UGC (contenido generado por usuarios): creadores, empleados, embajadores.
- Diferentes caras visibles, diferentes géneros, diferentes tipologías de persona.
- Contenido de socios/microinfluencers: funciona muy bien porque genera confianza en su audiencia.

### Modelo nuevo de iteración creativa
- Tomar un guion ganador y adaptarlo a:
  - 5 avatares diferentes
  - 5 estilos diferentes
  - 3 frameworks/estructuras de guion
  - 3 personas diferentes grabando
  - 3 niveles de conciencia
  - 3 hooks diferentes
- Esto genera variedad masiva que alimenta correctamente a Andromeda.

### Cadencia creativa
- **Funnel Evergreen (activo 24/7):** incorporar nuevos anuncios cada 7 días mínimo.
- **Lanzamientos:** usar "olas creativas":
  - Iniciar con ~70% del arsenal creativo.
  - Fase test de 3-5 días para sacar data.
  - Cada 6-7 días incorporar nuevos anuncios que el sistema no ha visto.
  - Crear nuevos anuncios dentro del mismo lanzamiento basados en lo que funciona.
  - Esto reduce la fatiga creativa y mejora el rendimiento.
- Mínimo 10 anuncios nuevos por semana para mantenerse competitivo.
- La fatiga creativa con Andromeda es mucho más rápida que antes.

### Tipos de anuncios que mejor funcionan

**Problema → Solución:**
- Despertar un punto de dolor y ofrecer el producto/servicio como solución.
- La gente compra soluciones, no productos.

**Social Proof (Prueba social):**
- Reseñas reales de clientes.
- Pedir a clientes satisfechos que graben vídeo-reseñas a cambio de producto gratis o descuento.
- La gente necesita validación externa para comprar.

**Us vs. Them (Nosotros vs. la competencia):**
- Destacar ventajas competitivas en forma de bullet points.
- Generar distinción clara frente a alternativas.

**Ads de Promoción:**
- Captar leads de forma barata porque la gente está más dispuesta a comprar.
- Elimina la fricción del precio.

### Estructura del anuncio en era Andromeda
- Antes: un anuncio largo (1-1.5 min) con Hook → Problema → Solución → Prueba social → CTA.
- Ahora: micro-vídeos de máximo 30 segundos, cada uno enfocado en un bloque:
  - Vídeo de Atención/Hook
  - Vídeo de Problema y Solución
  - Vídeo de Prueba Social
  - Vídeo de Call to Action
- Andromeda se encarga de distribuir estos micro-anuncios en el momento correcto del funnel del usuario.
- El anuncio de atención se muestra a público frío.
- El de prueba social se muestra a público tibio.
- El de CTA se muestra a personas con más probabilidad de convertir.

---

## Pixel y API de Conversiones

### Qué es el Pixel
- Código que se instala en el sitio web/aplicación para que Meta vea toda la actividad de los usuarios.
- Monitorea: visitas a páginas, categorías visitadas, botones presionados, formularios completados, agendamientos, compras.
- Cruza datos con los datos de Meta del usuario (país, ciudad, edad, email si disponible).
- Es como una base de datos de todo el tráfico que llega a tu web.

### Qué es la API de conversiones (CAPI)
- Envía información directamente desde el servidor a los servidores de Meta (no depende del navegador).
- Nació en 2021 como respuesta a iOS 14 que limitó el uso de cookies.
- Recupera información que el Pixel no puede enviar (bloqueadores de anuncios, restricciones de iOS).
- Trabaja junto con el Pixel: si uno falla, el otro cubre. Los eventos se deduplican automáticamente.

### Configuración obligatoria
- Pixel + API de conversiones siempre juntos. No está bien tener solo uno.
- Activar coincidencias avanzadas automáticas: email, teléfono, nombre, apellido, sexo, ciudad, país, fecha de nacimiento.
- Generar y guardar el token de acceso de la API de conversiones.
- Agregar dominios autorizados para el Pixel.
- Activar seguimiento automático de cuentas publicitarias.
- La calidad de datos debe estar en 9/10 mínimo (no solo coincidencia, sino calidad).

### Tendencia: API sobre Pixel
- La API de conversiones es el dato real. El Pixel da datos que puede (imprecisos por bloqueos).
- Plataformas como Shopify y WooCommerce facilitan la configuración de la API.
- La recomendación es migrar progresivamente de Pixel a API de conversiones como fuente principal.

### Eventos importantes
- PageView (vista de página)
- ViewContent (ver producto)
- AddToCart (agregar al carrito)
- InitiateCheckout (iniciar pago)
- Purchase (compra)
- Lead (cliente potencial)
- Contact (contactar)
- Cada evento alimenta el aprendizaje de Andromeda sobre qué tipo de usuario tiene mayor intención de compra.

### Envío máximo de señales
- Enviar todos los parámetros disponibles: email, Facebook Click ID, y cualquier dato captado.
- Meta Andromeda necesita señales de calidad al 100%.
- Datos malos = optimización mala. Si le envías datos incorrectos, optimizará hacia conversiones de baja calidad.
- No usar soluciones automáticas tipo "Pixel or" — la implementación debe estar bien hecha.

---

## Campañas de Bajo Presupuesto ($3-5/día)

### Reglas fundamentales
- Usar objetivo de Ventas (no Interacción) para encontrar personas con probabilidad de compra.
- Una sola campaña, un solo conjunto de anuncios.
- Máximo 2-3 anuncios (si tienes menos de $3/día, solo 1-2).
- No crear estructuras complejas: el presupuesto se diluye y Andromeda no aprende.
- Presupuesto de campaña Advantage activado para distribución automática.

### Segmentación con bajo presupuesto
- Con poco presupuesto, no intentar impactar todo un país.
- Centrarse en una ciudad específica.
- Si la ciudad es muy grande (>1-2M habitantes), usar radio geográfico (2-5 km) alrededor del negocio.
- Edad amplia, dejar que Meta encuentre el rango óptimo.
- No agregar intereses ni segmentación detallada — Andrómeda se encarga.

### Ubicaciones
- Desactivar: páginas web externas, Audience Network, Marketplace (según el negocio), columna derecha.
- Mantener solo Facebook e Instagram (feeds, stories, reels).

### Creativos para bajo presupuesto
- Usar IA (ChatGPT, Gemini) para generar textos de venta optimizados.
- 3 ángulos recomendados: dolor/problema, caso real/prueba social, miedo/objeción.
- Vídeos tipo selfie de 15 segundos funcionan muy bien.
- Canva para imágenes editables rápidas.
- Gemini para generar imágenes con IA.
- Activar generación de variaciones de Meta AI en el anuncio.
- Desactivar mejoras automáticas de Meta que no siempre funcionan bien (música, efectos 3D, retoques visuales excesivos).

### Duración mínima de campaña
- 7 días como mínimo para validar resultados.
- Si funciona, desactivar fecha de finalización para mantenerla activa.

---

## Campañas de WhatsApp

### Configuración
- Objetivo: Ventas → Destino de mensajes → Solo WhatsApp.
- Maximizar número de conversaciones (no conversiones, a menos que tengas Pixel configurado).
- Configurar editor de chat con mensaje predefinido de bienvenida.
- Vincular número de WhatsApp Business.

### Estrategia de ventas por WhatsApp
- WhatsApp genera mayor tasa de entrega que landing pages porque hay cercanía con el cliente.
- La persona siente que habló con un humano y confirma su pedido.
- ROI típicamente mayor que ventas por landing page.
- Se invierte menos y se vende más comparado con landing pages.

### Automatización con chatbots
- Programar el dialecto según la región de venta.
- Mantener un hilo conversacional natural que simule interacción humana.
- Delegar a partir de 20-30 ventas diarias: una persona por cada 80-100 pedidos.
- Persona dedicada a novedades (cancelaciones, devoluciones) recupera pedidos perdidos.

---

## Atribución Incremental

### Qué es
- Modelo de atribución que optimiza la entrega para conversiones incrementales.
- Usa machine learning entrenado con miles de estudios de lift incrementales.
- Solo cuenta conversiones que fueron CAUSADAS por el anuncio (no las que hubieran ocurrido de todas formas).
- Diferente a 7-day click/1-day view que captura TODAS las conversiones.

### Resultados
- 24% de aumento en conversiones incrementales vs. atribución estándar (dato oficial de Meta).
- Aplicable a todos los anunciantes, sin importar tamaño.
- Compatible con múltiples objetivos: ventas, engagement, leads.
- Compatible con múltiples ubicaciones de conversión: web, web+app, web+in-store.
- Totalmente compatible con value optimization.

### Cómo configurarlo
- A nivel de ad set → sección de conversión → attribution model → cambiar de "standard" a "incremental".
- Se puede seguir viendo 7-day click/1-day view en columnas de comparación.
- Comparar atribución incremental vs. estándar para entender la sobrereportación.

### Uso recomendado
- Ejecutar conversion lift test para validar que performa mejor que BAU.
- Ideal para análisis creativo: identificar qué anuncios realmente mueven el negocio.
- Los anuncios con más atribuciones incrementales son los que genuinamente están adquiriendo nuevos clientes.
- ROAS incremental siempre será menor que ROAS estándar (es más honesto).

---

## Prueba de Contenido (Content Test)

### Nueva funcionalidad de Meta
- Permite testear hasta 5 anuncios diferentes dentro del mismo conjunto de anuncios con presupuesto garantizado.
- Resuelve el problema de que Meta concentre todo el presupuesto en un solo anuncio.

### Configuración
- A nivel de anuncio → "Prueba de contenido" → configurar de 2 a 5 versiones.
- Asignar máximo 20% del presupuesto diario del conjunto a las pruebas.
- Definir duración (7-30 días).
- Elegir métrica de comparación: costo por compra recomendado para campañas de ventas.

### Cuándo usarlo
- Ideal para presupuestos bajos donde no puedes crear conjuntos de anuncios separados para cada test.
- No reinicia la fase de aprendizaje del conjunto de anuncios.
- Para cuentas grandes (+10,000€/mes) no es tan necesario: pueden testear anuncios aislados.
- Con Andromeda, meter nuevos anuncios en conjuntos activos no destruye el rendimiento (la fase de aprendizaje no es tan crítica como se creía).

---

## Métricas y Análisis

### Reglas de análisis
- SIEMPRE analizar en ventanas de 7 días, nunca día a día.
- No hacer cambios por emociones, solo por datos.
- La mejor optimización a veces es no hacer nada y dejar que Andromeda trabaje.
- Cada edición en la campaña reinicia el aprendizaje — proteger el aprendizaje ganado.

### Métricas clave
- **Beneficio neto:** la métrica más importante (no ROAS, no CPA).
- **Costo por resultado (CPR/CPA):** cuánto cuesta cada conversión.
- **ROAS:** retorno sobre inversión publicitaria.
- **CPM:** costo por mil impresiones (indicador de competitividad y relevancia).
- **Costo por conversación:** para campañas de mensajes/WhatsApp.
- **Frecuencia:** si se dispara en audiencias amplias, indica falta de diversidad creativa.

### Breakdowns avanzados
- **Día de la semana:** gastar más en los días de mejor rendimiento (ej. viernes-domingo) y menos en días malos (ej. lunes-jueves).
- **Edad y género:** entender dónde gastar el dinero.
- **Nuevos vs. existentes:** monitorear la proporción de gasto en prospecting vs. engaged vs. existing.

### Análisis creativo con atribución incremental
- Mirar qué anuncios tienen más atribuciones incrementales para identificar los que realmente mueven el negocio.
- No confiar solo en ROAS estándar: puede inflar resultados de anuncios que no causan conversiones.

### Checklist diario del media buyer moderno
1. ¿Hay beneficio neto?
2. ¿Mis creatividades son claras y diversas?
3. ¿Estoy dejando aprender al sistema?
4. ¿He evitado cambios innecesarios?

---

## Señales de Calidad para Andromeda

### Principio fundamental
- Ya no gana quien segmenta mejor, sino quien le da mejores señales al algoritmo.
- Tu trabajo: darle condiciones al algoritmo, no tocar botones constantemente.
- Alimentar el algoritmo, no forzarlo.

### Señales correctas desde creativos
- Incluir precio en el anuncio: filtra personas sin intención de compra real.
- No incluir precio atrae tráfico que rebota → señales incorrectas a Andromeda.
- Hook claro en los primeros 2 segundos que identifique al público objetivo.
- Si alguien que no es tu público ve el anuncio, debe pasar de largo (eso es buena señal).
- Mensajes coherentes y directos.

### Señales desde el Pixel/API
- Eventos limpios, frecuentes y bien configurados.
- Si tienes menos de 3 conversiones por semana, optimizar por un evento anterior (ej. add to cart en vez de purchase).
- API de conversiones obligatoria para datos precisos.
- Enviar máximos parámetros (email, FBCLID, etc.).

### Señales desde estructura de cuenta
- Segmentación abierta (broad) + anuncios específicos = la segmentación la hace el contenido.
- No microsegmentar con intereses (no se actualizan desde abril 2025).
- Audiencias Advantage con inteligencia artificial activadas.
- El contenido desde su hook, retención, guion persuasivo y CTA debe hablarle a la gente correcta.

---

## Errores Comunes a Evitar

1. **Estructuras fragmentadas:** muchos conjuntos de anuncios con poco presupuesto = Andromeda no aprende.
2. **Pocos creativos:** 3-4 anuncios ya no son suficientes. Mínimo 15-30 para que Andromeda tenga información.
3. **Ignorar señales de conversión:** Pixel/API mal configurados = optimización hacia conversiones de baja calidad.
4. **Anuncios genéricos:** sin alma, poco específicos = CPMs altísimos. Andromeda no sabe a quién mostrárselos.
5. **Cambiar demasiado rápido:** dar mínimo 3-5 días por conjunto de anuncios. No cambiar segmentación, presupuesto y anuncios al mismo tiempo.
6. **Entrar en pánico:** días buenos seguidos de días malos es normal con Andromeda mientras aprende. No tocarlo todo a la vez.
7. **Contenido redundante:** si todos tus anuncios se parecen (mismo estilo, mismo hook, misma persona), Andromeda penaliza.
8. **No separar prospecting de retargeting:** el Pixel se entrena con clientes existentes y deja de buscar nuevos.
9. **Optimizar por evento incorrecto:** si quieres ventas, usa objetivo de ventas (no reconocimiento ni tráfico para "ahorrar").
10. **No proteger el aprendizaje:** cada edición en la campaña reinicia el aprendizaje ganado.

---

## Metodología Creativa Completa

### Proceso de 8 fases
1. **Investigación:** conocer avatar, problemas, deseos, falsas creencias, objeciones, datos demográficos y psicográficos.
2. **Inspiración:** ser obseso con librerías de anuncios, entender qué formatos funcionan en tu sector y otros.
3. **Conceptualización:** determinar narrativas, ángulos, crear guiones. Definir concepto = avatar + template.
4. **Briefing:** comunicar al equipo creativo exactamente qué tipo de contenido desarrollar.
5. **Ejecución:** producción de vídeos, imágenes, carruseles con el equipo creativo.
6. **Feedback:** exigir calidad, corregir antes de lanzar.
7. **Testing:** metodología de testeo estructurada con data.
8. **Iteración y escalado:** detectar ganadores, iterar con variaciones y escalar.

### Concepto = Avatar + Template
- Un concepto no es solo "una nueva idea de anuncio".
- Es la combinación de un avatar específico + un template visual/narrativo.
- Cada concepto se matchea a una audiencia semi-única.
- Diferentes conceptos tienen diferentes rangos de eficiencia (ROAS) y escala (gasto posible).
- Un concepto a 2x ROAS que gasta $1,500/día es valioso si es rentable. No cortar solo porque otro tiene 7x (que quizás solo gasta $100/día).
- Cortar conceptos "menos eficientes" pero rentables destruye el top of funnel que alimenta a los anuncios más eficientes.

### Flywheel creativo
1. Lanzar nuevos anuncios.
2. Esperar 7-14 días.
3. Analizar con atribución incremental.
4. Tomar ganadores y desarrollar nuevos conceptos basados en ellos.
5. Inyectar ideas de competidores.
6. Repetir.

---

## Contenido Orgánico en 2026

### Cambio de red social a red de interés
- El algoritmo ahora muestra contenido primero a NO seguidores, no a seguidores.
- Si los no seguidores interactúan, se escala a más no seguidores.
- La métrica más importante: tiempo real de visualización (no likes ni comentarios).
- El engagement es efecto colateral de la retención.

### Implicación para anuncios
- Pensar cada pieza de contenido como si fuera para alguien que no te conoce.
- La segmentación se hace desde el contenido: hook, retención, guion persuasivo y CTA deben hablarle a tu público.
- Crear series de continuidad (como capítulos de Netflix) para construir autoridad.
- El reel se reposiciona como formato dominante para competir con TikTok.

### Sinergia orgánico-pago
- Usar publicaciones existentes como anuncios (reutilizar ID de publicación) para acumular engagement y prueba social.
- Todo el engagement de diferentes campañas se acumula en el mismo post.
- Contenido de microinfluencers compartido como "contenido de socios" funciona muy bien.

---

## Resumen Ejecutivo: Las 4 Palancas del Escalado Moderno

1. **Señal:** Pixel + API de conversiones perfectamente configurados. Eventos frecuentes y limpios. Nota de calidad >8/10.
2. **Estabilidad:** Analizar en bloques de 7 días. No tocar por emociones. Menos ediciones = mejores resultados. Proteger el aprendizaje.
3. **Claridad:** Anuncios claros en los primeros 2 segundos. Coherencia visual. Mensaje directo que identifica al público objetivo.
4. **Libertad:** Segmentación abierta. Sin jaulas de intereses. Dejar que Andromeda haga la segmentación basada en las señales del contenido.

**La regla de oro:** Tu creatividad es tu única ventaja competitiva. El juego ya no es encontrar la audiencia correcta para tu anuncio, sino crear el anuncio correcto que construya su propia audiencia.
`;

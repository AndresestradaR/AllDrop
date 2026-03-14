export const metadata = {
  title: 'Política de Privacidad | EstrategasIA',
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-white text-gray-800 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Política de Privacidad</h1>
        <p className="text-gray-500 text-sm mb-8">Última actualización: 14 de marzo de 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Información que recopilamos</h2>
            <p>
              EstrategasIA (&quot;nosotros&quot;, &quot;la plataforma&quot;) recopila la siguiente información cuando utilizas nuestros servicios:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong>Datos de cuenta:</strong> nombre, correo electrónico y contraseña al registrarte.</li>
              <li><strong>Datos de Meta Ads:</strong> cuando conectas tu cuenta de Meta, accedemos a tus cuentas publicitarias, campañas, conjuntos de anuncios y métricas de rendimiento a través de la API de Meta Marketing.</li>
              <li><strong>Claves API:</strong> las claves de terceros que proporcionas (Meta, Anthropic, etc.) se almacenan cifradas con AES-256-GCM y solo se usan para ejecutar acciones en tu nombre.</li>
              <li><strong>Historial de conversaciones:</strong> los mensajes que intercambias con nuestro asistente de IA se almacenan para mantener el contexto de tus conversaciones.</li>
              <li><strong>Datos de uso:</strong> información técnica como dirección IP, tipo de navegador y páginas visitadas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Cómo usamos tu información</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>Proveer y mejorar nuestros servicios de gestión de campañas publicitarias con IA.</li>
              <li>Ejecutar acciones en Meta Ads según tus instrucciones (crear campañas, modificar presupuestos, etc.).</li>
              <li>Enviar notificaciones relacionadas con tu cuenta y servicios.</li>
              <li>Analizar el uso de la plataforma para mejorar la experiencia.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Compartición de datos</h2>
            <p>No vendemos ni compartimos tu información personal con terceros, excepto:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong>Meta (Facebook):</strong> para ejecutar las acciones que solicitas en tus campañas publicitarias.</li>
              <li><strong>Anthropic:</strong> los mensajes de chat se envían a la API de Claude para generar respuestas de IA.</li>
              <li><strong>Proveedores de infraestructura:</strong> Supabase (base de datos), Vercel (hosting), Cloudflare (CDN).</li>
              <li><strong>Requerimientos legales:</strong> cuando sea necesario para cumplir con la ley.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Seguridad de los datos</h2>
            <p>
              Todas las claves API y tokens de acceso se almacenan cifrados con AES-256-GCM. Las comunicaciones se realizan a través de HTTPS. Implementamos controles de acceso basados en filas (RLS) en nuestra base de datos para que solo puedas acceder a tus propios datos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Retención de datos</h2>
            <p>
              Conservamos tus datos mientras mantengas una cuenta activa. Puedes solicitar la eliminación de tus datos en cualquier momento contactándonos. Las conversaciones de IA se conservan para mantener el historial, pero pueden ser eliminadas por el usuario.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Tus derechos</h2>
            <p>Tienes derecho a:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Acceder a tus datos personales.</li>
              <li>Rectificar información incorrecta.</li>
              <li>Solicitar la eliminación de tus datos.</li>
              <li>Revocar el acceso a tu cuenta de Meta en cualquier momento desde la configuración de Facebook.</li>
              <li>Exportar tus datos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Cookies</h2>
            <p>
              Utilizamos cookies esenciales para mantener tu sesión activa y cookies de análisis para mejorar el servicio. No utilizamos cookies de publicidad de terceros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Contacto</h2>
            <p>
              Si tienes preguntas sobre esta política, puedes contactarnos en:{' '}
              <a href="mailto:soporteritualdebelleza@gmail.com" className="text-blue-600 hover:underline">
                soporteritualdebelleza@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export const metadata = {
  title: 'Condiciones del Servicio | EstrategasIA',
}

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-white text-gray-800 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Condiciones del Servicio</h1>
        <p className="text-gray-500 text-sm mb-8">Última actualización: 14 de marzo de 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Aceptación de los términos</h2>
            <p>
              Al acceder y utilizar EstrategasIA (&quot;la plataforma&quot;), aceptas estos términos y condiciones en su totalidad. Si no estás de acuerdo, no utilices la plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Descripción del servicio</h2>
            <p>
              EstrategasIA es una plataforma de herramientas de inteligencia artificial diseñada para emprendedores de dropshipping y comercio electrónico. Los servicios incluyen:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Gestión de campañas de Meta Ads mediante IA conversacional.</li>
              <li>Generación de contenido visual (imágenes, videos, banners).</li>
              <li>Creación de landing pages y tiendas online.</li>
              <li>Herramientas de investigación de productos.</li>
              <li>Generación de ebooks y contenido de marketing.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Cuentas de usuario</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>Debes proporcionar información veraz al registrarte.</li>
              <li>Eres responsable de mantener la seguridad de tu cuenta y contraseña.</li>
              <li>No puedes compartir tu cuenta con terceros.</li>
              <li>Debes ser mayor de 18 años para utilizar la plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Modelo BYOK (Bring Your Own Keys)</h2>
            <p>
              La plataforma opera bajo un modelo BYOK donde el usuario proporciona sus propias claves API de terceros (Meta, Anthropic, Google, OpenAI, etc.). Esto significa que:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Los costos de uso de APIs de terceros son responsabilidad del usuario.</li>
              <li>EstrategasIA no se responsabiliza por cargos generados en cuentas de terceros.</li>
              <li>Las claves API se almacenan cifradas y solo se usan para ejecutar acciones solicitadas.</li>
              <li>Puedes revocar el acceso eliminando tus claves en cualquier momento.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Meta Ads IA</h2>
            <p>Al utilizar la funcionalidad de Meta Ads IA:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Autorizas a la plataforma a acceder a tus cuentas publicitarias de Meta en tu nombre.</li>
              <li>Las acciones que modifiquen campañas (crear, pausar, cambiar presupuesto) requieren tu confirmación explícita antes de ejecutarse.</li>
              <li>EstrategasIA no garantiza resultados específicos de rendimiento publicitario.</li>
              <li>Eres responsable de cumplir con las políticas publicitarias de Meta.</li>
              <li>Las recomendaciones de la IA son sugerencias, la decisión final es siempre tuya.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Uso aceptable</h2>
            <p>No puedes:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Usar la plataforma para actividades ilegales o fraudulentas.</li>
              <li>Intentar acceder a datos de otros usuarios.</li>
              <li>Realizar ingeniería inversa del software.</li>
              <li>Usar bots o scripts automatizados no autorizados.</li>
              <li>Publicar contenido que viole derechos de autor o marcas registradas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Limitación de responsabilidad</h2>
            <p>
              EstrategasIA se proporciona &quot;tal cual&quot;. No garantizamos que el servicio sea ininterrumpido o libre de errores. No somos responsables por pérdidas directas o indirectas derivadas del uso de la plataforma, incluyendo pero no limitado a pérdidas publicitarias, oportunidades de negocio perdidas, o daños a la reputación.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Propiedad intelectual</h2>
            <p>
              El contenido generado por las herramientas de IA (imágenes, textos, videos) es propiedad del usuario que lo genera. La plataforma, su código, diseño y marca son propiedad de EstrategasIA.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Modificaciones</h2>
            <p>
              Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios serán publicados en esta página. El uso continuado de la plataforma después de los cambios constituye aceptación.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Contacto</h2>
            <p>
              Para consultas sobre estos términos:{' '}
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

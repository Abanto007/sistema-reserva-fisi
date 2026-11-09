/**
 * Tarjeta centrada de las pantallas de autenticación (figuras 1-11 del informe):
 * fondo azul noche, línea roja superior, píldora "FISI • UNMSM", título,
 * subtítulo y pie gris con enlace.
 */
export function PildoraFisi() {
  return <span className="pildora-fisi">FISI • UNMSM</span>;
}

export default function AuthCard({ titulo, subtitulo, ancho = "normal", pie, children }) {
  const clase = ancho === "ancha" ? "auth-card auth-card--ancha" : ancho === "media" ? "auth-card auth-card--media" : "auth-card";
  return (
    <main className="auth-fondo">
      <section className={clase}>
        <div className="auth-card__cuerpo">
          <header className="auth-card__cabecera">
            <PildoraFisi />
            <h1 className="auth-card__titulo">{titulo}</h1>
            {subtitulo && <p className="auth-card__subtitulo">{subtitulo}</p>}
          </header>
          {children}
        </div>
        {pie && <footer className="auth-card__pie">{pie}</footer>}
      </section>
    </main>
  );
}

export default function SetupNotice({ title, file }) {
  return (
    <div className="panel">
      <p className="panel-title">{title}</p>
      <p className="row-sub">
        Jedwali husika halipo bado kwenye Supabase. Fungua Supabase, nenda <strong>SQL Editor</strong>, kisha endesha
        faili <code>{file}</code> (liko kwenye repo). Ukimaliza, onyesha upya ukurasa huu.
      </p>
    </div>
  )
}

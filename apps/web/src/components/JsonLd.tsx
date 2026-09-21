/** Renders a JSON-LD <script> tag. JSON.stringify already escapes quotes; only guard against `</script>` breaking out of the tag. */
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

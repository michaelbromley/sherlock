/** Markdown files imported with `with { type: 'text' }` are their contents */
declare module '*.md' {
    const text: string;
    export default text;
}

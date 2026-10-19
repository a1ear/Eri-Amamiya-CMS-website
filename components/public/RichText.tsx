import { Fragment } from "react";
import { parseRichText, type Inline } from "@/lib/richText";

function InlineNode({ node }: { node: Inline }) {
  switch (node.type) {
    case "bold":
      return <strong className="font-semibold">{node.text}</strong>;
    case "link":
      return (
        <a
          href={node.href}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className="break-words underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {node.text}
        </a>
      );
    default:
      return <>{node.text}</>;
  }
}

/** Renders owner-written text as paragraphs. Never interprets HTML. */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {parseRichText(text).map((lines, p) => (
        <p key={p}>
          {lines.map((line, l) => (
            <Fragment key={l}>
              {l > 0 && <br />}
              {line.map((node, n) => (
                <InlineNode key={n} node={node} />
              ))}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

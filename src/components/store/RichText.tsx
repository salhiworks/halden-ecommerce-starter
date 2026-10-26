import type { ReactNode } from "react";

/**
 * Renders text an owner typed in the dashboard. Deliberately tiny: blank
 * lines make paragraphs, lines starting with "- " make a list, "### " a
 * small heading. No HTML is ever interpreted, so nothing typed into a
 * product description can inject markup into the page.
 */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const out: ReactNode[] = [];

  blocks.forEach((block, blockIndex) => {
    const lines = block.split("\n").filter((line) => line.trim() !== "");
    if (lines.length === 0) return;

    if (lines.every((line) => /^\s*[-•]\s+/.test(line))) {
      out.push(
        <ul key={blockIndex}>
          {lines.map((line, index) => (
            <li key={index}>{line.replace(/^\s*[-•]\s+/, "")}</li>
          ))}
        </ul>,
      );
      return;
    }

    if (lines[0].startsWith("### ")) {
      out.push(<h3 key={`${blockIndex}-h`}>{lines[0].slice(4)}</h3>);
      lines.shift();
      if (lines.length === 0) return;
    }

    out.push(
      <p key={blockIndex}>
        {lines.map((line, index) => (
          <span key={index}>
            {index > 0 && <br />}
            {line}
          </span>
        ))}
      </p>,
    );
  });

  return <div className={`prose-store ${className}`}>{out}</div>;
}

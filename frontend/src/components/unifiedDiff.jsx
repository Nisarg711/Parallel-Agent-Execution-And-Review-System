"use client";

import { useMemo } from "react";
import { html as diffToHtml } from "diff2html";
// diff2html isn't a "compare two texts" tool at all — it's a parser for exactly 
// this format. It reads the diff --git/@@/+/- structure you can
//  see in your screenshot's raw diff, understands that this is a 
//  unified diff (not file content), and renders it as what it 
//  actually represents:
export function UnifiedDiff({ diffText }) {
  const html = useMemo(
    () =>
      diffToHtml(diffText, {
        drawFileList: true,
        matching: "lines",
        outputFormat: "line-by-line",
        colorScheme: "dark",
      }),
    [diffText]
  );

  // diff2html escapes the diff's code content itself before rendering it as
  // HTML, so this is safe even though the diff text originates from agent output.
  return <div className="diff2html-wrapper" dangerouslySetInnerHTML={{ __html: html }} />;
}
import React, { useRef, useImperativeHandle } from "react";

export interface EditorHandle {
  getHTML(): string;
  setHTML(html: string): void;
}

const EMPTY = ["", "<div><br></div>", "<br>"];

export const RichTextEditor = React.forwardRef<EditorHandle, {
  onBlurChange: (html: string) => void;
  placeholder?: string;
}>(({ onBlurChange, placeholder = "Add a description…" }, ref) => {
  const divRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getHTML: () => {
      const html = divRef.current?.innerHTML ?? "";
      return EMPTY.includes(html) ? "" : html;
    },
    setHTML: (html: string) => {
      if (divRef.current) divRef.current.innerHTML = html;
    },
  }));

  const execCmd = (cmd: string) => {
    document.execCommand(cmd, false);
    divRef.current?.focus();
  };

  return (
    <div className="panel-desc-editor-wrap">
      <div className="editor-toolbar">
        <button className="editor-btn" onMouseDown={e => { e.preventDefault(); execCmd("bold"); }}><strong>B</strong></button>
        <button className="editor-btn" onMouseDown={e => { e.preventDefault(); execCmd("italic"); }}><em>I</em></button>
        <button className="editor-btn" onMouseDown={e => { e.preventDefault(); execCmd("underline"); }}><u>U</u></button>
        <button className="editor-btn" onMouseDown={e => { e.preventDefault(); execCmd("strikeThrough"); }}><s>S</s></button>
        <div className="editor-sep" />
        <button className="editor-btn" onMouseDown={e => { e.preventDefault(); execCmd("insertUnorderedList"); }}>•—</button>
        <button className="editor-btn" onMouseDown={e => { e.preventDefault(); execCmd("insertOrderedList"); }}>1.</button>
        <div className="editor-sep" />
        <button className="editor-btn" onMouseDown={e => { e.preventDefault(); execCmd("removeFormat"); }}>Aa</button>
      </div>
      <div
        ref={divRef}
        className="panel-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onBlur={() => {
          const html = divRef.current?.innerHTML ?? "";
          onBlurChange(EMPTY.includes(html) ? "" : html);
        }}
        onKeyDown={e => {
          if ((e.ctrlKey || e.metaKey) && e.key === "b") { e.preventDefault(); execCmd("bold"); }
          if ((e.ctrlKey || e.metaKey) && e.key === "i") { e.preventDefault(); execCmd("italic"); }
          if ((e.ctrlKey || e.metaKey) && e.key === "u") { e.preventDefault(); execCmd("underline"); }
        }}
      />
    </div>
  );
});

RichTextEditor.displayName = "RichTextEditor";

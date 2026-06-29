import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const MIN_HEIGHT = 36;
const MAX_HEIGHT = 128;

type ComposerTextareaProps = {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

export const ComposerTextarea = forwardRef<HTMLTextAreaElement, ComposerTextareaProps>(function ComposerTextarea(
  { value, placeholder, onChange },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);

  function resize() {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(Math.max(node.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }

  useEffect(() => {
    resize();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      className="composer-textarea"
      value={value}
      rows={1}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onInput={resize}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }
      }}
      aria-label={placeholder ?? "Message"}
    />
  );
});
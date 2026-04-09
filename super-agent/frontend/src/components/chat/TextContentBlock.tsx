/**
 * TextContentBlock Component
 *
 * Renders a text content block with full markdown formatting
 * using react-markdown with GFM (GitHub Flavored Markdown) support.
 *
 * Requirements: 9.1
 *
 * @module components/chat/TextContentBlock
 */

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { TextContentBlock as TextContentBlockType } from '@/services/chatStreamService';

interface TextContentBlockProps {
  block: TextContentBlockType;
}

export function TextContentBlock({ block }: TextContentBlockProps) {
  return (
    <div className="text-sm text-gray-100 leading-relaxed prose prose-invert prose-sm max-w-none" data-testid="text-content-block">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => <h1 className="text-lg font-bold text-white mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold text-white mt-3 mb-1.5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold text-white mt-2 mb-1">{children}</h3>,
          // Paragraphs
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          // Lists
          ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="text-gray-200">{children}</li>,
          // Inline code
          code: ({ className, children }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              const lang = className?.replace('language-', '') || '';
              return (
                <div className="my-2">
                  {lang && <div className="text-xs text-gray-500 font-mono mb-0.5">{lang}</div>}
                  <code className="text-sm text-gray-200 font-mono">{children}</code>
                </div>
              );
            }
            return (
              <code className="bg-gray-700 text-gray-200 px-1.5 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            );
          },
          // Code blocks
          pre: ({ children }) => (
            <pre className="bg-gray-900 border border-gray-700 rounded-lg p-3 my-2 overflow-x-auto">
              {children}
            </pre>
          ),
          // Bold / italic
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
          // Links
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
              {children}
            </a>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-gray-600 pl-3 my-2 text-gray-400 italic">
              {children}
            </blockquote>
          ),
          // Horizontal rule
          hr: () => <hr className="border-gray-700 my-3" />,
          // Tables (GFM)
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-sm border border-gray-700">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-800">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-1.5 text-left font-semibold text-gray-300 border-b border-gray-700">{children}</th>,
          td: ({ children }) => <td className="px-3 py-1.5 text-gray-300 border-b border-gray-800">{children}</td>,
        }}
      >
        {block.text}
      </Markdown>
    </div>
  );
}

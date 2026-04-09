/**
 * Unit tests for TextContentBlock component.
 *
 * Validates: Requirement 9.1 — text content rendered with markdown formatting.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextContentBlock } from './TextContentBlock';
import type { TextContentBlock as TextContentBlockType } from '@/services/chatStreamService';

function makeBlock(text: string): TextContentBlockType {
  return { type: 'text', text };
}

describe('TextContentBlock', () => {
  it('should render plain text', () => {
    render(<TextContentBlock block={makeBlock('Hello, world!')} />);
    expect(screen.getByTestId('text-content-block')).toHaveTextContent('Hello, world!');
  });

  it('should render bold text with **markers**', () => {
    render(<TextContentBlock block={makeBlock('This is **bold** text')} />);
    const strong = screen.getByTestId('text-content-block').querySelector('strong');
    expect(strong).toBeInTheDocument();
    expect(strong).toHaveTextContent('bold');
  });

  it('should render italic text with *markers*', () => {
    render(<TextContentBlock block={makeBlock('This is *italic* text')} />);
    const em = screen.getByTestId('text-content-block').querySelector('em');
    expect(em).toBeInTheDocument();
    expect(em).toHaveTextContent('italic');
  });

  it('should render inline code with `backticks`', () => {
    render(<TextContentBlock block={makeBlock('Run `npm install` first')} />);
    const code = screen.getByTestId('text-content-block').querySelector('code');
    expect(code).toBeInTheDocument();
    expect(code).toHaveTextContent('npm install');
  });

  it('should render fenced code blocks', () => {
    const text = 'Before\n```js\nconsole.log("hi");\n```\nAfter';
    render(<TextContentBlock block={makeBlock(text)} />);
    const pre = screen.getByTestId('text-content-block').querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre).toHaveTextContent('console.log("hi");');
  });

  it('should display language label for fenced code blocks', () => {
    const text = '```typescript\nconst x = 1;\n```';
    render(<TextContentBlock block={makeBlock(text)} />);
    expect(screen.getByText('typescript')).toBeInTheDocument();
  });

  it('should render empty text without crashing', () => {
    render(<TextContentBlock block={makeBlock('')} />);
    expect(screen.getByTestId('text-content-block')).toBeInTheDocument();
  });

  it('should preserve whitespace in text', () => {
    render(<TextContentBlock block={makeBlock('Line 1\nLine 2')} />);
    const container = screen.getByTestId('text-content-block');
    expect(container).toHaveTextContent('Line 1');
    expect(container).toHaveTextContent('Line 2');
  });

  it('should render multiple inline formats in the same text', () => {
    render(
      <TextContentBlock block={makeBlock('**bold** and *italic* and `code`')} />
    );
    const container = screen.getByTestId('text-content-block');
    expect(container.querySelector('strong')).toHaveTextContent('bold');
    expect(container.querySelector('em')).toHaveTextContent('italic');
    expect(container.querySelector('code')).toHaveTextContent('code');
  });
});

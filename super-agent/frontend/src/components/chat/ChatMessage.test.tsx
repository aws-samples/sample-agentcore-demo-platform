/**
 * Unit tests for ChatMessage component.
 *
 * Validates: Requirements 9.1, 9.2, 9.3 — renders content blocks for an assistant turn.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from './ChatMessage';
import type { ContentBlock } from '@/services/chatStreamService';

describe('ChatMessage', () => {
  it('should render nothing when content is empty', () => {
    const { container } = render(<ChatMessage content={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render a text content block', () => {
    const content: ContentBlock[] = [{ type: 'text', text: 'Hello, world!' }];
    render(<ChatMessage content={content} />);
    expect(screen.getByTestId('text-content-block')).toHaveTextContent('Hello, world!');
  });

  it('should render a tool_use content block', () => {
    const content: ContentBlock[] = [
      { type: 'tool_use', id: 'tu_1', name: 'Bash', input: { command: 'ls' } },
    ];
    render(<ChatMessage content={content} />);
    expect(screen.getByTestId('tool-use-block')).toBeInTheDocument();
    expect(screen.getByText('Bash')).toBeInTheDocument();
  });

  it('should render a tool_result content block', () => {
    const content: ContentBlock[] = [
      { type: 'tool_result', tool_use_id: 'tu_1', content: 'output', is_error: false },
    ];
    render(<ChatMessage content={content} />);
    expect(screen.getByTestId('tool-result-block')).toBeInTheDocument();
    expect(screen.getByText('Result')).toBeInTheDocument();
  });

  it('should render mixed content blocks in order', () => {
    const content: ContentBlock[] = [
      { type: 'text', text: 'Let me check...' },
      { type: 'tool_use', id: 'tu_1', name: 'Read', input: { file_path: '/config.json' } },
      { type: 'tool_result', tool_use_id: 'tu_1', content: '{"key":"value"}', is_error: false },
      { type: 'text', text: 'The file contains a key-value pair.' },
    ];
    render(<ChatMessage content={content} />);

    const textBlocks = screen.getAllByTestId('text-content-block');
    expect(textBlocks).toHaveLength(2);
    expect(textBlocks[0]).toHaveTextContent('Let me check...');
    expect(textBlocks[1]).toHaveTextContent('The file contains a key-value pair.');

    expect(screen.getByTestId('tool-use-block')).toBeInTheDocument();
    expect(screen.getByTestId('tool-result-block')).toBeInTheDocument();
  });

  it('should display the model name when provided', () => {
    const content: ContentBlock[] = [{ type: 'text', text: 'Hello' }];
    render(<ChatMessage content={content} model="claude-sonnet-4-5-20250929" />);
    expect(screen.getByText('claude-sonnet-4-5-20250929')).toBeInTheDocument();
  });

  it('should not display model name when not provided', () => {
    const content: ContentBlock[] = [{ type: 'text', text: 'Hello' }];
    render(<ChatMessage content={content} />);
    expect(screen.queryByText(/claude/)).not.toBeInTheDocument();
  });

  it('should render the assistant avatar', () => {
    const content: ContentBlock[] = [{ type: 'text', text: 'Hello' }];
    render(<ChatMessage content={content} />);
    expect(screen.getByTestId('chat-message')).toBeInTheDocument();
  });

  it('should render error tool results with error styling', () => {
    const content: ContentBlock[] = [
      { type: 'tool_result', tool_use_id: 'tu_1', content: 'Command failed', is_error: true },
    ];
    render(<ChatMessage content={content} />);
    const resultBlock = screen.getByTestId('tool-result-block');
    expect(resultBlock).toHaveAttribute('data-error', 'true');
    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});

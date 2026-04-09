/**
 * Unit tests for ToolUseBlock component.
 *
 * Validates: Requirement 9.2 — tool name displayed with collapsible tool input.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolUseBlock } from './ToolUseBlock';
import type { ToolUseContentBlock } from '@/services/chatStreamService';

function makeBlock(overrides?: Partial<ToolUseContentBlock>): ToolUseContentBlock {
  return {
    type: 'tool_use',
    id: 'tu_123',
    name: 'Bash',
    input: { command: 'ls -la' },
    ...overrides,
  };
}

describe('ToolUseBlock', () => {
  it('should render the tool name', () => {
    render(<ToolUseBlock block={makeBlock()} />);
    expect(screen.getByText('Bash')).toBeInTheDocument();
  });

  it('should not show tool input by default (collapsed)', () => {
    render(<ToolUseBlock block={makeBlock()} />);
    expect(screen.queryByText(/"command"/)).not.toBeInTheDocument();
  });

  it('should expand to show tool input JSON when clicked', async () => {
    const user = userEvent.setup();
    render(<ToolUseBlock block={makeBlock()} />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(screen.getByText(/"command"/)).toBeInTheDocument();
    expect(screen.getByText(/"ls -la"/)).toBeInTheDocument();
  });

  it('should collapse tool input when clicked again', async () => {
    const user = userEvent.setup();
    render(<ToolUseBlock block={makeBlock()} />);

    const button = screen.getByRole('button');
    await user.click(button); // expand
    expect(screen.getByText(/"command"/)).toBeInTheDocument();

    await user.click(button); // collapse
    expect(screen.queryByText(/"command"/)).not.toBeInTheDocument();
  });

  it('should set aria-expanded correctly', async () => {
    const user = userEvent.setup();
    render(<ToolUseBlock block={makeBlock()} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('should render different tool names', () => {
    render(<ToolUseBlock block={makeBlock({ name: 'Read' })} />);
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('should render complex input objects', async () => {
    const user = userEvent.setup();
    const block = makeBlock({
      input: { file_path: '/config.json', encoding: 'utf-8' },
    });
    render(<ToolUseBlock block={block} />);

    await user.click(screen.getByRole('button'));
    expect(screen.getByText(/"file_path"/)).toBeInTheDocument();
    expect(screen.getByText(/\/config\.json/)).toBeInTheDocument();
  });

  it('should have the correct test id', () => {
    render(<ToolUseBlock block={makeBlock()} />);
    expect(screen.getByTestId('tool-use-block')).toBeInTheDocument();
  });
});

/**
 * Unit tests for ToolResultBlock component.
 *
 * Validates: Requirement 9.3 — tool output in collapsible section with error styling.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolResultBlock } from './ToolResultBlock';
import type { ToolResultContentBlock } from '@/services/chatStreamService';

function makeBlock(overrides?: Partial<ToolResultContentBlock>): ToolResultContentBlock {
  return {
    type: 'tool_result',
    tool_use_id: 'tu_123',
    content: 'file1.txt\nfile2.txt',
    is_error: false,
    ...overrides,
  };
}

describe('ToolResultBlock', () => {
  it('should render "Result" label for successful results', () => {
    render(<ToolResultBlock block={makeBlock()} />);
    expect(screen.getByText('Result')).toBeInTheDocument();
  });

  it('should render "Error" label for error results', () => {
    render(<ToolResultBlock block={makeBlock({ is_error: true, content: 'Command failed' })} />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('should not show content by default (collapsed)', () => {
    render(<ToolResultBlock block={makeBlock()} />);
    expect(screen.queryByText('file1.txt')).not.toBeInTheDocument();
  });

  it('should expand to show content when clicked', async () => {
    const user = userEvent.setup();
    render(<ToolResultBlock block={makeBlock()} />);

    await user.click(screen.getByRole('button'));
    expect(screen.getByText(/file1\.txt/)).toBeInTheDocument();
    expect(screen.getByText(/file2\.txt/)).toBeInTheDocument();
  });

  it('should collapse content when clicked again', async () => {
    const user = userEvent.setup();
    render(<ToolResultBlock block={makeBlock()} />);

    await user.click(screen.getByRole('button')); // expand
    expect(screen.getByText(/file1\.txt/)).toBeInTheDocument();

    await user.click(screen.getByRole('button')); // collapse
    expect(screen.queryByText('file1.txt')).not.toBeInTheDocument();
  });

  it('should set aria-expanded correctly', async () => {
    const user = userEvent.setup();
    render(<ToolResultBlock block={makeBlock()} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('should apply error styling when is_error is true', () => {
    render(<ToolResultBlock block={makeBlock({ is_error: true, content: 'Error output' })} />);
    const container = screen.getByTestId('tool-result-block');
    expect(container).toHaveAttribute('data-error', 'true');
  });

  it('should apply success styling when is_error is false', () => {
    render(<ToolResultBlock block={makeBlock({ is_error: false })} />);
    const container = screen.getByTestId('tool-result-block');
    expect(container).toHaveAttribute('data-error', 'false');
  });

  it('should show "(no output)" when content is null', () => {
    render(<ToolResultBlock block={makeBlock({ content: null })} />);
    expect(screen.getByText('(no output)')).toBeInTheDocument();
  });

  it('should show "(no output)" when content is empty string', () => {
    render(<ToolResultBlock block={makeBlock({ content: '' })} />);
    expect(screen.getByText('(no output)')).toBeInTheDocument();
  });

  it('should disable the button when there is no content', () => {
    render(<ToolResultBlock block={makeBlock({ content: null })} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should have the correct test id', () => {
    render(<ToolResultBlock block={makeBlock()} />);
    expect(screen.getByTestId('tool-result-block')).toBeInTheDocument();
  });
});

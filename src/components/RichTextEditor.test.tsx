/**
 * Tests for RichTextEditor component
 * F025: Rich text formatting engine
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { RichTextEditor } from './RichTextEditor';

// Clean up after each test
afterEach(() => {
  cleanup();
});

describe('RichTextEditor Component', () => {
  describe('F025 Acceptance Criteria', () => {
    it('renders editor with toolbar', () => {
      render(<RichTextEditor />);

      // Toolbar buttons should be present
      expect(screen.getByLabelText(/Bold/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Italic/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Underline/)).toBeInTheDocument();
    });

    it('supports bold formatting via toolbar', async () => {
      const { container } = render(<RichTextEditor />);
      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;

      // Type some text
      editor.textContent = 'Test text';
      fireEvent.input(editor);

      // Select all
      const range = document.createRange();
      range.selectNodeContents(editor);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Click bold button
      const buttons = screen.getAllByLabelText(/Bold/);
      const boldButton = buttons[0];
      fireEvent.click(boldButton);

      await waitFor(() => {
        expect(boldButton).toHaveClass('bg-white/20');
      });
    });

    it('supports italic formatting via toolbar', async () => {
      const { container } = render(<RichTextEditor />);
      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;

      editor.textContent = 'Test text';
      fireEvent.input(editor);

      const range = document.createRange();
      range.selectNodeContents(editor);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      const buttons = screen.getAllByLabelText(/Italic/);
      const italicButton = buttons[0];
      fireEvent.click(italicButton);

      await waitFor(() => {
        expect(italicButton).toHaveClass('bg-white/20');
      });
    });

    it('supports underline formatting via toolbar', async () => {
      const { container } = render(<RichTextEditor />);
      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;

      editor.textContent = 'Test text';
      fireEvent.input(editor);

      const range = document.createRange();
      range.selectNodeContents(editor);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      const buttons = screen.getAllByLabelText(/Underline/);
      const underlineButton = buttons[0];
      fireEvent.click(underlineButton);

      await waitFor(() => {
        expect(underlineButton).toHaveClass('bg-white/20');
      });
    });

    it('supports keyboard shortcut Cmd+B', () => {
      const { container } = render(<RichTextEditor />);
      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;

      editor.textContent = 'Test';
      const range = document.createRange();
      range.selectNodeContents(editor);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      fireEvent.keyDown(editor, { key: 'b', metaKey: true });

      // Check that format was applied
      expect(editor.querySelector('strong')).toBeTruthy();
    });

    it('formatting persists in HTML', () => {
      const onChange = vi.fn();
      const { container } = render(<RichTextEditor onChange={onChange} />);
      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;

      editor.innerHTML = '<strong>Bold text</strong>';
      fireEvent.input(editor);

      expect(onChange).toHaveBeenCalled();
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall[0]).toContain('<strong>');
    });

    it('exports formatted content correctly', () => {
      const onChange = vi.fn();
      render(<RichTextEditor value="<em>Italic</em>" onChange={onChange} />);

      // Value should be set in editor
      const editor = screen.getByRole('textbox');
      expect(editor.innerHTML).toContain('<em>');
    });
  });

  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<RichTextEditor />);
      const editor = screen.getByRole('textbox');
      expect(editor).toBeInTheDocument();
    });

    it('renders without toolbar when showToolbar=false', () => {
      render(<RichTextEditor showToolbar={false} />);
      expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    });

    it('shows placeholder text', () => {
      const { container } = render(<RichTextEditor placeholder="Enter text here" />);
      const editor = container.querySelector('[data-placeholder]');
      expect(editor).toHaveAttribute('data-placeholder', 'Enter text here');
    });

    it('applies custom className', () => {
      const { container } = render(<RichTextEditor className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('applies custom editorClassName', () => {
      render(<RichTextEditor editorClassName="editor-custom" />);
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveClass('editor-custom');
    });

    it('sets custom minHeight', () => {
      render(<RichTextEditor minHeight="300px" />);
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveStyle({ minHeight: '300px' });
    });

    it('sets aria-label', () => {
      render(<RichTextEditor ariaLabel="My custom editor" />);
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('aria-label', 'My custom editor');
    });
  });

  describe('Disabled state', () => {
    it('disables contentEditable when disabled=true', () => {
      const { container } = render(<RichTextEditor disabled={true} />);
      const editor = container.querySelector('[contenteditable]');
      expect(editor).toHaveAttribute('contenteditable', 'false');
    });

    it('disables format buttons when disabled=true', () => {
      render(<RichTextEditor disabled={true} />);
      const buttons = screen.getAllByLabelText(/Bold/);
      expect(buttons[0]).toBeDisabled();
    });

    it('sets aria-disabled when disabled', () => {
      render(<RichTextEditor disabled={true} />);
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Value prop', () => {
    it('initializes with value prop', () => {
      render(<RichTextEditor value="<strong>Initial</strong>" />);
      const editor = screen.getByRole('textbox');
      expect(editor.innerHTML).toContain('Initial');
    });

    it('updates when value prop changes', () => {
      const { rerender } = render(<RichTextEditor value="First" />);
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveTextContent('First');

      rerender(<RichTextEditor value="Second" />);
      expect(editor).toHaveTextContent('Second');
    });
  });

  describe('onChange callback', () => {
    it('calls onChange on input', () => {
      const onChange = vi.fn();
      const { container } = render(<RichTextEditor onChange={onChange} />);
      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;

      editor.textContent = 'New text';
      fireEvent.input(editor);

      expect(onChange).toHaveBeenCalled();
    });

    it('provides HTML content to onChange', () => {
      const onChange = vi.fn();
      const { container } = render(<RichTextEditor onChange={onChange} />);
      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;

      editor.innerHTML = '<strong>Bold</strong>';
      fireEvent.input(editor);

      expect(onChange).toHaveBeenCalledWith(expect.stringContaining('Bold'));
    });

    it('calls onChange after format button click', async () => {
      const onChange = vi.fn();
      const { container } = render(<RichTextEditor onChange={onChange} />);
      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;

      editor.textContent = 'Text';
      onChange.mockClear();

      const range = document.createRange();
      range.selectNodeContents(editor);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      const buttons = screen.getAllByLabelText(/Bold/);
      fireEvent.click(buttons[0]);

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
    });
  });

  describe('Format buttons', () => {
    it('shows active state for bold button', async () => {
      const { container } = render(<RichTextEditor />);
      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;

      editor.innerHTML = '<strong>Bold text</strong>';
      const strongElement = editor.querySelector('strong');

      if (strongElement) {
        const range = document.createRange();
        range.selectNodeContents(strongElement);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        // Trigger selection change
        fireEvent.click(editor);

        await waitFor(() => {
          const buttons = screen.getAllByLabelText(/Bold/);
          expect(buttons[0]).toHaveClass('bg-white/20');
        });
      }
    });

    it('format buttons have correct labels', () => {
      render(<RichTextEditor />);

      const boldButtons = screen.getAllByLabelText(/Bold \(Cmd\+B\)/);
      const italicButtons = screen.getAllByLabelText(/Italic \(Cmd\+I\)/);
      const underlineButtons = screen.getAllByLabelText(/Underline \(Cmd\+U\)/);

      expect(boldButtons.length).toBeGreaterThan(0);
      expect(italicButtons.length).toBeGreaterThan(0);
      expect(underlineButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Sanitization', () => {
    it('sanitizes HTML by default', () => {
      const onChange = vi.fn();
      const { container } = render(<RichTextEditor onChange={onChange} />);
      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;

      editor.innerHTML = '<script>alert("XSS")</script><strong>Safe</strong>';
      fireEvent.input(editor);

      const html = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
      expect(html).not.toContain('<script>');
    });

    it('can disable sanitization', () => {
      const onChange = vi.fn();
      const { container } = render(<RichTextEditor onChange={onChange} sanitize={false} />);
      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;

      editor.innerHTML = '<div>Not sanitized</div>';
      fireEvent.input(editor);

      const html = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
      expect(html).toContain('<div>');
    });
  });

  describe('Auto-focus', () => {
    it('does not auto-focus by default', () => {
      render(<RichTextEditor />);
      const editor = screen.getByRole('textbox');
      expect(editor).not.toHaveFocus();
    });

    it('auto-focuses when autoFocus=true', () => {
      render(<RichTextEditor autoFocus={true} />);
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA roles', () => {
      render(<RichTextEditor />);

      expect(screen.getByRole('toolbar')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('toolbar has aria-label', () => {
      render(<RichTextEditor />);
      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toHaveAttribute('aria-label', 'Text formatting toolbar');
    });

    it('editor has aria-multiline', () => {
      render(<RichTextEditor />);
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('aria-multiline', 'true');
    });

    it('format buttons have title attributes', () => {
      render(<RichTextEditor />);

      const buttons = screen.getAllByLabelText(/Bold/);
      expect(buttons[0]).toHaveAttribute('title');
    });
  });

  describe('Edge cases', () => {
    it('handles empty content', () => {
      render(<RichTextEditor value="" />);
      const editor = screen.getByRole('textbox');
      expect(editor.textContent).toBe('');
    });

    it('handles missing onChange gracefully', () => {
      const { container } = render(<RichTextEditor />);
      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;

      editor.textContent = 'Test';
      expect(() => fireEvent.input(editor)).not.toThrow();
    });

    it('handles rapid format changes', async () => {
      const { container } = render(<RichTextEditor />);
      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement;

      editor.textContent = 'Test';
      const range = document.createRange();
      range.selectNodeContents(editor);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      const boldButtons = screen.getAllByLabelText(/Bold/);
      const italicButtons = screen.getAllByLabelText(/Italic/);

      fireEvent.click(boldButtons[0]);
      fireEvent.click(italicButtons[0]);
      fireEvent.click(boldButtons[0]);

      // Should not throw
      expect(editor).toBeInTheDocument();
    });
  });
});

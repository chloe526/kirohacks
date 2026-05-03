import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EndSessionConfirmDialog } from '@/components/modals/EndSessionConfirmDialog';

describe('EndSessionConfirmDialog', () => {
  const mockOnGoBack = vi.fn();
  const mockOnLeaveAnyway = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <EndSessionConfirmDialog
        isOpen={false}
        onGoBack={mockOnGoBack}
        onLeaveAnyway={mockOnLeaveAnyway}
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when isOpen is true', () => {
    render(
      <EndSessionConfirmDialog
        isOpen={true}
        onGoBack={mockOnGoBack}
        onLeaveAnyway={mockOnLeaveAnyway}
      />
    );
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Confirm Leave Session')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure\? The session will remain open until a report is submitted\./)).toBeInTheDocument();
  });

  it('displays warning message about session remaining open', () => {
    render(
      <EndSessionConfirmDialog
        isOpen={true}
        onGoBack={mockOnGoBack}
        onLeaveAnyway={mockOnLeaveAnyway}
      />
    );
    
    expect(screen.getByText(/Without a report, this session cannot be properly closed/)).toBeInTheDocument();
  });

  it('calls onGoBack when "Go Back" button is clicked', () => {
    render(
      <EndSessionConfirmDialog
        isOpen={true}
        onGoBack={mockOnGoBack}
        onLeaveAnyway={mockOnLeaveAnyway}
      />
    );
    
    fireEvent.click(screen.getByText('Go Back'));
    expect(mockOnGoBack).toHaveBeenCalledTimes(1);
  });

  it('calls onLeaveAnyway when "Leave Anyway" button is clicked', () => {
    render(
      <EndSessionConfirmDialog
        isOpen={true}
        onGoBack={mockOnGoBack}
        onLeaveAnyway={mockOnLeaveAnyway}
      />
    );
    
    fireEvent.click(screen.getByText('Leave Anyway'));
    expect(mockOnLeaveAnyway).toHaveBeenCalledTimes(1);
  });

  it('calls onGoBack when backdrop is clicked', () => {
    render(
      <EndSessionConfirmDialog
        isOpen={true}
        onGoBack={mockOnGoBack}
        onLeaveAnyway={mockOnLeaveAnyway}
      />
    );
    
    // Click on the backdrop (the outer div)
    fireEvent.click(screen.getByRole('dialog'));
    expect(mockOnGoBack).toHaveBeenCalledTimes(1);
  });

  it('calls onGoBack when Escape key is pressed', () => {
    render(
      <EndSessionConfirmDialog
        isOpen={true}
        onGoBack={mockOnGoBack}
        onLeaveAnyway={mockOnLeaveAnyway}
      />
    );
    
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(mockOnGoBack).toHaveBeenCalledTimes(1);
  });

  it('does not call callbacks when clicking inside the dialog content', () => {
    render(
      <EndSessionConfirmDialog
        isOpen={true}
        onGoBack={mockOnGoBack}
        onLeaveAnyway={mockOnLeaveAnyway}
      />
    );
    
    // Click on the dialog content (should not trigger backdrop click)
    fireEvent.click(screen.getByText('Confirm Leave Session'));
    expect(mockOnGoBack).not.toHaveBeenCalled();
    expect(mockOnLeaveAnyway).not.toHaveBeenCalled();
  });
});
"use client";

import { useState, useEffect } from "react";
import { X, Save, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SystemPromptResponse {
  prompt: string;
}

export default function SystemPromptDialog({ isOpen, onClose }: SystemPromptDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch system prompt when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchSystemPrompt();
    }
  }, [isOpen]);

  // Track changes
  useEffect(() => {
    setHasChanges(prompt !== "");
  }, [prompt]);

  const fetchSystemPrompt = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("http://localhost:8000/system-prompt", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch system prompt: ${response.status}`);
      }

      const data: SystemPromptResponse = await response.json();
      setPrompt(data.prompt || "");
    } catch (error) {
      console.error("Error fetching system prompt:", error);
      setError("Failed to load system prompt. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const saveSystemPrompt = async () => {
    if (!prompt.trim()) {
      setError("System prompt cannot be empty");
      return;
    }

    if (prompt.length < 50) {
      setError("System prompt must be at least 50 characters long");
      return;
    }

    if (prompt.length > 50000) {
      setError("System prompt cannot exceed 50,000 characters");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("http://localhost:8000/system-prompt", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save system prompt: ${response.status}`);
      }

      setSuccess(true);
      setHasChanges(false);
      
      // Auto-hide success message after 2 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 2000);
    } catch (error) {
      console.error("Error saving system prompt:", error);
      setError("Failed to save system prompt. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to close without saving?"
      );
      if (!confirmed) return;
    }
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleClose}
          />

          {/* Modal Container */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div 
              className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col transform transition-all"
              onKeyDown={handleKeyDown}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 rounded-t-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg
                      className="h-5 w-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      System Prompt Configuration
                    </h3>
                    <p className="text-sm text-gray-500">
                      Configure the AI assistant's system prompt
                    </p>
                  </div>
                </div>
                <button
                  title="Close"
                  onClick={handleClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Character Count */}
                <div className="mb-4 flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Character count: {prompt.length} / 50,000
                  </div>
                  <div className="text-sm text-gray-500">
                    Minimum: 50 characters
                  </div>
                </div>

                {/* Error/Success Messages */}
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <p className="text-green-800 text-sm">System prompt saved successfully!</p>
                  </div>
                )}

                {/* Loading State */}
                {isLoading && (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <div className="mb-4">
                        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Loading system prompt...
                      </h3>
                      <p className="text-gray-600">
                        Please wait while we fetch the current configuration
                      </p>
                    </div>
                  </div>
                )}

                {/* Textarea */}
                {!isLoading && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="system-prompt" className="block text-sm font-medium text-gray-700 mb-2">
                        System Prompt
                      </label>
                      <textarea
                        id="system-prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Enter the system prompt for the AI assistant. This should be at least 50 characters long and maximum 50,000 characters..."
                        className={cn(
                          "w-full h-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 resize-none",
                          error ? "border-red-300 focus:ring-red-500" : "",
                          "font-mono text-sm leading-relaxed"
                        )}
                        disabled={isSaving}
                      />
                    </div>

                    {/* Help Text */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Guidelines:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• The system prompt defines how the AI assistant behaves and responds</li>
                        <li>• Be specific about the assistant's role, tone, and capabilities</li>
                        <li>• Include examples of desired responses if helpful</li>
                        <li>• Keep it clear and concise while being comprehensive</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              {!isLoading && (
                <div className="p-6 border-t border-gray-200 rounded-b-xl bg-gray-50">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      {hasChanges && "You have unsaved changes"}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleClose}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveSystemPrompt}
                        disabled={isSaving || !hasChanges || prompt.length < 50 || prompt.length > 50000}
                        className={cn(
                          "px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import type { GeneralQuestionPayload } from '@/types/agent';

interface GeneralAnswerDisplayProps {
  payload: GeneralQuestionPayload;
}

export function GeneralAnswerDisplay({ payload }: GeneralAnswerDisplayProps) {
  return (
    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">
      {payload.answer}
    </p>
  );
}

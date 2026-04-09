import { useTranslation } from '@/i18n'
import type { QuickQuestion } from '@/types'

interface QuickQuestionsProps {
  questions: QuickQuestion[]
  onQuestionClick: (question: QuickQuestion) => void
  isLoading?: boolean
}

function QuestionCard({ question, onClick }: { question: QuickQuestion; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 px-4 py-3 bg-gray-800/60 rounded-xl border border-gray-700/50
                 hover:border-blue-500/50 hover:bg-gray-800 transition-all text-left group"
    >
      <span className="text-xl flex-shrink-0 mt-0.5">{question.icon}</span>
      <div className="min-w-0">
        <span className="text-xs text-gray-500 block mb-0.5">{question.category}</span>
        <span className="text-sm text-gray-300 group-hover:text-white block leading-snug">
          {question.text}
        </span>
      </div>
    </button>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 max-w-2xl w-full animate-pulse">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-[72px] bg-gray-800/60 rounded-xl border border-gray-700/30" />
      ))}
    </div>
  )
}

export function QuickQuestions({ questions, onQuestionClick, isLoading = false }: QuickQuestionsProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">{t('chat.quickQuestions')}</h3>
        <LoadingSkeleton />
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>Start a conversation by sending a message</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <h3 className="text-sm font-medium text-gray-400 mb-4">{t('chat.quickQuestions')}</h3>
      <div className="grid grid-cols-2 gap-3 max-w-2xl w-full">
        {questions.slice(0, 6).map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            onClick={() => onQuestionClick(question)}
          />
        ))}
      </div>
    </div>
  )
}

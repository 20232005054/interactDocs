"use client"

import { cn } from "@/lib/utils"

export type StepKey = "basic" | "core-info" | "summary" | "structure"

export interface Step {
  key: StepKey
  label: string
  filled: boolean
}

interface TemplateStepperProps {
  steps: Step[]
  activeStep: StepKey
  onStepClick: (key: StepKey) => void
}

export default function TemplateStepper({ steps, activeStep, onStepClick }: TemplateStepperProps) {
  return (
    <div className="flex items-center justify-center w-full py-2">
      {steps.map((step, idx) => {
        const isActive = step.key === activeStep
        const isLast = idx === steps.length - 1

        return (
          <div key={step.key} className="flex items-center">
            {/* 步骤节点 */}
            <button
              type="button"
              onClick={() => onStepClick(step.key)}
              className="flex items-center gap-2 group"
            >
              {/* 圆形指示器 */}
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all",
                isActive
                  ? "bg-green-500 border-green-500 text-white"
                  : step.filled
                    ? "bg-green-100 border-green-400 text-green-600"
                    : "bg-white border-gray-300 text-gray-500 group-hover:border-green-400 group-hover:text-green-500"
              )}>
                {idx + 1}
              </div>
              {/* 标签 */}
              <span className={cn(
                "text-sm whitespace-nowrap transition-colors",
                isActive ? "text-green-600 font-medium" : "text-gray-500 group-hover:text-gray-700"
              )}>
                {step.label}
              </span>
            </button>

            {/* 连接线 */}
            {!isLast && (
              <div className="w-16 h-px mx-3 bg-gray-300" />
            )}
          </div>
        )
      })}
    </div>
  )
}


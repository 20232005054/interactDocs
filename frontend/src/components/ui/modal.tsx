import * as React from "react"
import { cn } from "@/lib/utils"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

interface ModalOverlayProps {
  isOpen: boolean
  onClose: () => void
  className?: string
}

interface ModalContentProps {
  children: React.ReactNode
  className?: string
}

interface ModalHeaderProps {
  title: string
  onClose: () => void
  className?: string
}

interface ModalBodyProps {
  children: React.ReactNode
  className?: string
}

const ModalOverlay: React.FC<ModalOverlayProps> = ({ isOpen, onClose, className }) => {
  if (!isOpen) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
        className
      )}
      onClick={onClose}
    />
  )
}

const ModalContent: React.FC<ModalContentProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        "fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg",
        className
      )}
    >
      {children}
    </div>
  )
}

const ModalHeader: React.FC<ModalHeaderProps> = ({ title, onClose, className }) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between mb-4",
        className
      )}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <button
        onClick={onClose}
        className="rounded-full p-1 hover:bg-muted"
      >
        ×
      </button>
    </div>
  )
}

const ModalBody: React.FC<ModalBodyProps> = ({ children, className }) => {
  return (
    <div className={cn(className)}>
      {children}
    </div>
  )
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className }) => {
  if (!isOpen) return null

  return (
    <>
      <ModalOverlay isOpen={isOpen} onClose={onClose} />
      <ModalContent className={className}>
        {title && <ModalHeader title={title} onClose={onClose} />}
        <ModalBody>{children}</ModalBody>
      </ModalContent>
    </>
  )
}

export { Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody }

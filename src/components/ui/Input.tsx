import { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  variant?: 'default' | 'filled'
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    type = 'text',
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    variant = 'default',
    id,
    ...props 
  }, ref) => {
    const generatedId = useId()
    const inputId = id || generatedId
    
    const baseStyles = 'block w-full rounded-md border-0 py-2 text-gray-900 shadow-sm ring-1 ring-inset placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6 transition-colors'
    
    const variants = {
      default: 'bg-white ring-gray-300 focus:ring-indigo-600',
      filled: 'bg-gray-50 ring-gray-200 focus:ring-indigo-600 focus:bg-white'
    }
    
    const errorStyles = error 
      ? 'ring-red-300 focus:ring-red-500 text-red-900 placeholder:text-red-300' 
      : variants[variant]

    const paddingStyles = leftIcon && rightIcon 
      ? 'pl-10 pr-10' 
      : leftIcon 
        ? 'pl-10 pr-3' 
        : rightIcon 
          ? 'pl-3 pr-10' 
          : 'px-3'

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium leading-6 text-gray-900 mb-1">
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <div className={cn('h-5 w-5', error ? 'text-red-400' : 'text-gray-400')}>
                {leftIcon}
              </div>
            </div>
          )}
          
          <input
            type={type}
            id={inputId}
            className={cn(
              baseStyles,
              errorStyles,
              paddingStyles,
              className
            )}
            ref={ref}
            autoComplete={props.autoComplete || "off"}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            data-form-type="other"
            {...props}
          />
          
          {rightIcon && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <div className={cn('h-5 w-5', error ? 'text-red-400' : 'text-gray-400')}>
                {rightIcon}
              </div>
            </div>
          )}
        </div>
        
        {error && (
          <p className="mt-1 text-sm text-red-600 flex items-center">
            <svg className="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        
        {helperText && !error && (
          <p className="mt-1 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
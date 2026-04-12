import { useState, useRef, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface VoiceTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  label?: string;
}

export function VoiceTextInput({ value, onChange, placeholder, rows = 3, className, label }: VoiceTextInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: 'Speech recognition not supported', description: 'Please use Chrome or Edge.', variant: 'destructive' });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognitionRef.current = recognition;

    let finalTranscript = value;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? ' ' : '') + transcript;
          onChange(finalTranscript);
        } else {
          interim += transcript;
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      if (event.error !== 'aborted') {
        toast({ title: 'Voice input error', description: event.error, variant: 'destructive' });
      }
    };

    recognition.onend = () => setIsRecording(false);

    recognition.start();
    setIsRecording(true);
    toast({ title: '🎤 Listening...', description: 'Speak now. Click the mic again to stop.' });
  }, [isRecording, value, onChange]);

  return (
    <div className={cn('relative', className)}>
      {label && <label className="text-sm font-medium text-foreground mb-1.5 block">{label}</label>}
      <div className="relative">
        <Textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={cn('pr-12', isRecording && 'border-destructive ring-1 ring-destructive/30')}
        />
        <Button
          type="button"
          variant={isRecording ? 'destructive' : 'ghost'}
          size="sm"
          className="absolute top-2 right-2 h-8 w-8 p-0"
          onClick={toggleRecording}
          title={isRecording ? 'Stop recording' : 'Start voice input'}
        >
          {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
      </div>
      {isRecording && (
        <div className="flex items-center gap-1.5 mt-1">
          <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-[11px] text-destructive">Recording...</span>
        </div>
      )}
    </div>
  );
}

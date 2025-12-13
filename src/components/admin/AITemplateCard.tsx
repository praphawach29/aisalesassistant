import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, Trash2 } from 'lucide-react';

interface AITemplate {
  id: string;
  name: string;
  description: string | null;
  ai_name: string;
  gender: string;
  formality_level: number;
  use_emoji: boolean;
  is_system: boolean;
}

interface AITemplateCardProps {
  template: AITemplate;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}

const genderLabels: Record<string, string> = {
  female: 'หญิง',
  male: 'ชาย',
  neutral: 'กลาง',
};

const formalityLabels: Record<number, string> = {
  1: 'เป็นกันเอง',
  2: 'เป็นกันเอง',
  3: 'ปานกลาง',
  4: 'เป็นทางการ',
  5: 'เป็นทางการมาก',
};

export function AITemplateCard({ template, isSelected, onSelect, onDelete }: AITemplateCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md relative group',
        isSelected && 'ring-2 ring-primary border-primary'
      )}
      onClick={onSelect}
    >
      <CardContent className="p-2.5 sm:p-4">
        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-primary text-primary-foreground rounded-full p-0.5 sm:p-1">
            <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
          </div>
        )}

        {/* Delete button for custom templates */}
        {onDelete && !isSelected && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 h-5 w-5 sm:h-6 sm:w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-destructive" />
          </Button>
        )}

        {/* Template name with emoji */}
        <h3 className="font-semibold text-xs sm:text-sm mb-1 pr-5 sm:pr-6 line-clamp-1">{template.name}</h3>
        
        {/* Description */}
        {template.description && (
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3 line-clamp-2">
            {template.description}
          </p>
        )}

        {/* Quick info badges */}
        <div className="flex flex-wrap gap-0.5 sm:gap-1">
          <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0">
            {template.ai_name}
          </Badge>
          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 py-0 hidden sm:inline-flex">
            {genderLabels[template.gender] || template.gender}
          </Badge>
          {template.use_emoji && (
            <Badge variant="outline" className="text-[10px] sm:text-xs px-1 py-0">
              😊
            </Badge>
          )}
        </div>

        {/* Formality level indicator */}
        <div className="mt-2 sm:mt-3">
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground mb-1">
            <span className="hidden sm:inline">ความเป็นทางการ</span>
            <span className="sm:hidden">ทางการ</span>
            <span>{formalityLabels[template.formality_level]}</span>
          </div>
          <div className="flex gap-0.5 sm:gap-1">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={cn(
                  'h-1 sm:h-1.5 flex-1 rounded-full',
                  level <= template.formality_level
                    ? 'bg-primary'
                    : 'bg-muted'
                )}
              />
            ))}
          </div>
        </div>

        {/* System badge */}
        {template.is_system && (
          <div className="mt-1.5 sm:mt-2">
            <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0">
              ระบบ
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
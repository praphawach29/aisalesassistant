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
      <CardContent className="p-4">
        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
            <Check className="w-3 h-3" />
          </div>
        )}

        {/* Delete button for custom templates */}
        {onDelete && !isSelected && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        )}

        {/* Template name with emoji */}
        <h3 className="font-semibold text-sm mb-1 pr-6 line-clamp-1">{template.name}</h3>
        
        {/* Description */}
        {template.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {template.description}
          </p>
        )}

        {/* Quick info badges */}
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-xs">
            {template.ai_name}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {genderLabels[template.gender] || template.gender}
          </Badge>
          {template.use_emoji && (
            <Badge variant="outline" className="text-xs">
              😊
            </Badge>
          )}
        </div>

        {/* Formality level indicator */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>ความเป็นทางการ</span>
            <span>{formalityLabels[template.formality_level]}</span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
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
          <div className="mt-2">
            <Badge variant="secondary" className="text-xs">
              ระบบ
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import React from 'react';
import { Badge } from "./badge";
import { Tag } from "lucide-react";

interface TagBadgeProps {
  label: string;
  color?: string;
  variant?: "outline" | "default" | "secondary";
  size?: "sm" | "default" | "lg";
  className?: string;
}

const TagBadge: React.FC<TagBadgeProps> = ({ 
  label,
  color = "text-gray-600",
  variant = "outline",
  size = "default",
  className = ""
}) => {
  return (
    <Badge
      variant={variant}
      className={`flex items-center gap-1 ${color} ${className} ${
        size === "sm" ? "text-xs px-2" :
        size === "lg" ? "text-base px-4 py-1" :
        "text-sm px-3"
      }`}
    >
      <Tag className={`
        ${size === "sm" ? "h-3 w-3" :
          size === "lg" ? "h-5 w-5" :
          "h-4 w-4"
        }
      `} />
      <span>{label}</span>
    </Badge>
  );
};

export default TagBadge;

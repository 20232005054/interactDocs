"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Trash2, ArrowRight } from "lucide-react";
import Link from "next/link";

export interface DocumentCardProps {
  id: string;
  title: string;
  summary?: string;
  updatedAt: string;
  onDelete?: (id: string) => void;
}

export function DocumentCard({ id, title, summary, updatedAt, onDelete }: DocumentCardProps) {
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg line-clamp-1">{title}</CardTitle>
          </div>
        </div>
        <CardDescription>
          更新于 {new Date(updatedAt).toLocaleDateString("zh-CN")}
        </CardDescription>
      </CardHeader>

      <CardFooter className="flex justify-between pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDelete?.(id)}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          删除
        </Button>
        <Link href={`/document/${id}`}>
          <Button size="sm" className="bg-primary hover:bg-primary/90">
            进入编辑
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

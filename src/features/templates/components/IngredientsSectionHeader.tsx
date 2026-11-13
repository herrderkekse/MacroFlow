import SectionHeader from "@/src/shared/components/SectionHeader";
import React from "react";
import { useTranslation } from "react-i18next";

interface IngredientsSectionHeaderProps {
    count: number;
    onAdd: () => void;
}

/** "+ INGREDIENTS  4 items" — adds an ingredient; heads the list. */
export default function IngredientsSectionHeader({ count, onAdd }: IngredientsSectionHeaderProps) {
    const { t } = useTranslation();
    return (
        <SectionHeader
            title={t("templates.ingredients")}
            hint={count > 0 ? t("common.itemCount", { count }) : undefined}
            onAdd={onAdd}
            addLabel={t("templates.addIngredient")}
            // Right under the macro card, which already keeps its distance.
            first
        />
    );
}

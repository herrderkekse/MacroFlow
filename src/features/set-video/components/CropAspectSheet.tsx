import ListGroup from "@/src/shared/components/ListGroup";
import ListRow from "@/src/shared/components/ListRow";
import Sheet from "@/src/shared/components/Sheet";
import { useThemeColors } from "@/src/shared/providers/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { CROP_ASPECTS, type CropAspectKey } from "../helpers/cropGeometry";

interface CropAspectSheetProps {
    visible: boolean;
    onClose: () => void;
    aspect: CropAspectKey;
    onChange: (aspect: CropAspectKey) => void;
}

// What each shape is for, after its name.
const DESCRIPTION: Record<CropAspectKey, string> = {
    original: "exercise.setVideo.aspectOriginalHint",
    "9:16": "exercise.setVideo.aspectPortrait",
    "4:5": "exercise.setVideo.aspectPortrait",
    "1:1": "exercise.setVideo.aspectSquare",
    "16:9": "exercise.setVideo.aspectLandscape",
};

/** The shapes the video can be cropped to; the chosen one is ticked. */
export default function CropAspectSheet({ visible, onClose, aspect, onChange }: CropAspectSheetProps) {
    const colors = useThemeColors();
    const { t } = useTranslation();

    return (
        <Sheet visible={visible} onClose={onClose} title={t("exercise.setVideo.aspectTitle")} subtitle={t("exercise.setVideo.aspectHint")}>
            <ListGroup>
                {CROP_ASPECTS.map(({ key }) => (
                    <ListRow
                        key={key}
                        title={key === "original" ? t("exercise.setVideo.aspectOriginal") : key}
                        subtitle={t(DESCRIPTION[key])}
                        onPress={() => {
                            onChange(key);
                            onClose();
                        }}
                        right={key === aspect ? <Ionicons name="checkmark" size={20} color={colors.text} /> : undefined}
                        showChevron={false}
                    />
                ))}
            </ListGroup>
        </Sheet>
    );
}

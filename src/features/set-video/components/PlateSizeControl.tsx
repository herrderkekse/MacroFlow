import React from "react";
import { useTranslation } from "react-i18next";
import Disclosure from "@/src/shared/components/Disclosure";
import SegmentedControl from "@/src/shared/components/SegmentedControl";
import { useAppStore } from "@/src/shared/store/useAppStore";
import { PLATE_DIAMETERS_M } from "../constants";
import { formatDistance } from "../helpers/barPathFormat";

interface PlateSizeControlProps {
    diameterM: number;
    onChange: (diameterM: number) => void;
}

/**
 * The real size of the marked plate, which turns the path's pixels into
 * distances. Tucked away: nearly every loaded bar wears full-size plates.
 */
export default function PlateSizeControl({ diameterM, onChange }: PlateSizeControlProps) {
    const { t } = useTranslation();
    const unitSystem = useAppStore((s) => s.unitSystem);
    const options = PLATE_DIAMETERS_M.map((d) => ({ key: Math.round(d * 100), label: formatDistance(d, unitSystem) }));

    return (
        <Disclosure title={t("barPath.plateSize", { size: formatDistance(diameterM, unitSystem) })} icon="resize-outline">
            <SegmentedControl options={options} value={Math.round(diameterM * 100)} onChange={(cm) => onChange(cm / 100)} size="sm" />
        </Disclosure>
    );
}

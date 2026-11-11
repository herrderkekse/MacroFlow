import type { IconName } from "@/src/shared/atoms/IconButton";
import ListRow from "@/src/shared/components/ListRow";
import Sheet from "@/src/shared/components/Sheet";
import React from "react";
import { StyleSheet, View } from "react-native";

export interface ActionSheetItem {
    key: string;
    label: string;
    description?: string;
    icon: IconName;
    onPress: () => void;
    destructive?: boolean;
    disabled?: boolean;
}

interface ActionSheetProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    actions: ActionSheetItem[];
}

/**
 * The one menu. Anything that used to be a stack of unlabeled floating
 * buttons, a centred pop-up menu or an overflow dialog is a list of labeled
 * actions in a sheet. Choosing an action closes the sheet first.
 */
export default function ActionSheet({ visible, onClose, title, subtitle, actions }: ActionSheetProps) {
    return (
        <Sheet visible={visible} onClose={onClose} title={title} subtitle={subtitle} padded={false}>
            <View style={styles.list}>
                {actions.map((action) => (
                    <ListRow
                        key={action.key}
                        icon={action.icon}
                        title={action.label}
                        subtitle={action.description}
                        destructive={action.destructive}
                        disabled={action.disabled}
                        showChevron={false}
                        onPress={() => {
                            onClose();
                            action.onPress();
                        }}
                    />
                ))}
            </View>
        </Sheet>
    );
}

const styles = StyleSheet.create({
    list: { paddingBottom: 4 },
});

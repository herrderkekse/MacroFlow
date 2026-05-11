export interface Photo {
    id: number;
    log_entry_id: number | null;
    image_path: string | null;
    image_data: string | null;
    workout_tag_id: number | null;
    notes: string | null;
    created_at: number;
    updated_at: number;
}

export type NewPhoto = Omit<Photo, "id">;

export interface PhotoTag {
    workoutId: number;
    workoutTitle: string | null;
    workoutDate: string;
}

export interface PhotoWithRelations extends Photo {
    workoutTag: PhotoTag | null;
}

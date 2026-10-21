ALTER TABLE baitly_directory_map_cells ADD COLUMN country_code VARCHAR(2) NOT NULL DEFAULT 'FR';
ALTER TABLE baitly_directory_map_cells ADD COLUMN service VARCHAR(30) NOT NULL DEFAULT '';
ALTER TABLE baitly_directory_map_cells DROP CONSTRAINT baitly_directory_map_cells_pkey;
ALTER TABLE baitly_directory_map_cells ADD PRIMARY KEY(revision,level,x,y,activity,contact_mask,country_code,service);
UPDATE baitly_directory_map_state SET revision=revision+1 WHERE id=true;

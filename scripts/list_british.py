import os
import csv

meta_file = "scripts/models/vox1_meta.csv"
base_dir = "scripts/models/ChatterboxTrainingAudioSamples"

dirs = set(os.listdir(base_dir))

meta = {}
with open(meta_file, "r", encoding="utf-8", errors="ignore") as f:
    for row in csv.reader(f, delimiter="\t"):
        if len(row) >= 4 and row[0].startswith("id"):
            meta[row[0].strip()] = {
                "id": row[0].strip(),
                "name": row[1].strip(),
                "gender": "female" if row[2].strip() == "f" else "male",
                "nat": row[3].strip().upper()
            }

uk_list = []
for v_id, info in meta.items():
    if info["nat"] in ["UK", "UK "]:
        clean_name = info["name"].replace(" ", "_").replace(".", "_")
        folder = f"vox_{clean_name}_{info['gender']}"
        if folder in dirs:
            uk_list.append((v_id, info["name"], info["gender"], folder))

print(f"Total valid UK folders in dataset: {len(uk_list)}")

# Known top famous British celebrities list to prioritize in ranking
famous_names = [
    "David_Attenborough", "Gordon_Ramsay", "Tom_Hiddleston", "Alan_Rickman", "Bear_Grylls",
    "Daniel_Craig", "Ricky_Gervais", "Bill_Nighy", "Matt_Smith", "Natalie_Dormer",
    "Brian_Cox", "Charles_Dance", "Eddie_Izzard", "Dominic_Cooper", "Iain_Glen",
    "John_Rhys-Davies", "Paul_McGann", "Peter_Coyote", "Rhys_Ifans", "Robert_Carlyle",
    "Rupert_Everett", "Sam_Heughan", "Sam_Riley", "Stephen_Baldwin", "Steven_Moffat",
    "Agyness_Deyn", "Alice_Eve", "Abbie_Cornish", "Alexandra_Roach", "Alex_Kingston",
    "Andrea_Riseborough", "Ashley_Jensen", "Bonnie_Wright", "Brenda_Blethyn", "Celia_Imrie",
    "Charlotte_Gainsbourg", "Cilla_Black", "Dawn_French", "Eleanor_Tomlinson", "Emily_Atack",
    "Felicity_Jones", "Finola_Hughes", "Fiona_Shaw", "Geri_Halliwell", "Hannah_Spearritt",
    "Heather_Graham", "Heike_Makatsch", "Joanna_Lumley", "Kaya_Scodelario", "Kate_Walsh"
]

# Sort: Famous names first, then remaining UK speakers
def sort_key(item):
    name_clean = item[1].replace(" ", "_").replace(".", "_")
    if name_clean in famous_names:
        return (0, famous_names.index(name_clean))
    return (1, item[0])

uk_list.sort(key=sort_key)

print("\nTop 50 British Celebrities Selected:")
for idx, (v_id, name, gender, folder) in enumerate(uk_list[:50], 1):
    id_num = v_id.replace("id", "")
    filename = f"{idx}_{id_num}_vox_{name.replace(' ', '_').replace('.', '_')}_{gender}.mp3"
    print(f"[{idx:02d}] {filename} -> Folder: {folder}")

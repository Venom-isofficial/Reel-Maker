import os
import csv

meta_file = "scripts/models/vox1_meta.csv"
base_dir = "scripts/models/ChatterboxTrainingAudioSamples"

dirs = set(os.listdir(base_dir))

meta = {}
with open(meta_file, "r", encoding="utf-8", errors="ignore") as f:
    for row in csv.reader(f, delimiter="\t"):
        if len(row) >= 4 and row[0].startswith("id"):
            v_id = row[0].strip()
            # 5-digit ID format e.g. id10015 -> 00015 (or 10015)
            num_part = v_id.replace("id", "")
            id_5digit = f"{int(num_part):05d}"
            meta[v_id] = {
                "v_id": v_id,
                "id_5digit": id_5digit,
                "name": row[1].strip(),
                "gender": "female" if row[2].strip() == "f" else "male",
                "nat": row[3].strip().upper()
            }

uk_speakers = []
for v_id, info in meta.items():
    if info["nat"] in ["UK", "UK "]:
        clean_name = info["name"].replace(" ", "_").replace(".", "_")
        folder = f"vox_{clean_name}_{info['gender']}"
        if folder in dirs:
            uk_speakers.append((v_id, info["name"], info["gender"], folder, info["id_5digit"]))

print(f"Total available British celebrity folders: {len(uk_speakers)}")

# Curated list of Top 100 Iconic British Celebrities (Ranks 1 to 50 used in Batch 1, Ranks 51 to 100 for Batch 2)
curated_british_ranking = [
    # Top 1-50 (Batch 1 Icons)
    "David_Attenborough", "Gordon_Ramsay", "Tom_Hiddleston", "Alan_Rickman", "Bear_Grylls",
    "Daniel_Craig", "Ricky_Gervais", "Bill_Nighy", "Matt_Smith", "Natalie_Dormer",
    "Brian_Cox", "Charles_Dance", "Eddie_Izzard", "Dominic_Cooper", "Iain_Glen",
    "John_Rhys-Davies", "Paul_McGann", "Peter_Coyote", "Rhys_Ifans", "Robert_Carlyle",
    "Rupert_Everett", "Sam_Heughan", "Sam_Riley", "Stephen_Baldwin", "Steven_Moffat",
    "Agyness_Deyn", "Alice_Eve", "Abbie_Cornish", "Alexandra_Roach", "Alex_Kingston",
    "Andrea_Riseborough", "Ashley_Jensen", "Bonnie_Wright", "Brenda_Blethyn", "Celia_Imrie",
    "Charlotte_Gainsbourg", "Cilla_Black", "Dawn_French", "Eleanor_Tomlinson", "Emily_Atack",
    "Felicity_Jones", "Finola_Hughes", "Fiona_Shaw", "Geri_Halliwell", "Hannah_Spearritt",
    "Heather_Graham", "Heike_Makatsch", "Joanna_Lumley", "Kaya_Scodelario", "Kate_Walsh",

    # Top 51-100 (Batch 2 Icons - Next 50 Best British Voices!)
    "Chris_Martin", "Chiwetel_Ejiofor", "Clive_Owen", "Damian_Lewis", "Dan_Stevens",
    "Danny_Dyer", "David_Harewood", "David_Jason", "David_Morrissey", "David_Oyelowo",
    "David_Suchet", "David_Tennant", "Derek_Jacobi", "Douglas_Booth", "Dougray_Scott",
    "Ed_Westwick", "Edgar_Wright", "Freddie_Highmore", "Gemma_Arterton", "Georgia_Moffett",
    "Hugh_Bonneville", "Ian_McShane", "Indira_Varma", "James_Purefoy", "Jason_Isaacs",
    "Jim_Broadbent", "Joanne_Froggatt", "John_Hurt", "Julian_Fellowes", "Kate_Beckinsale",
    "Keeley_Hawes", "Kenneth_Branagh", "Laura_Haddock", "Lena_Headey", "Lesley_Manville",
    "Mark_Gatiss", "Mark_Strong", "Martin_Freeman", "Mathew_Baynton", "Matthew_Goode",
    "Max_Irons", "Michael_Sheen", "Michelle_Dockery", "Naomie_Harris", "Nicholas_Hoult",
    "Nigel_Havers", "Ophelia_Lovibond", "Parminder_Nagra", "Paul_Bettany", "Peter_Capaldi"
]

def rank_sort_key(item):
    name_clean = item[1].replace(" ", "_").replace(".", "_")
    if name_clean in curated_british_ranking:
        return (0, curated_british_ranking.index(name_clean))
    return (1, item[0])

uk_speakers.sort(key=rank_sort_key)

# Ranks 51 to 100 for Next 50 Batch
batch2_next_50 = uk_speakers[50:100]

print("\n🇬🇧 Next 50 Best British Celebrity Accents Selected (Ranks 51 to 100):")
print("=" * 80)
for rank, (v_id, name, gender, folder, id_5digit) in enumerate(batch2_next_50, 51):
    clean_name = name.replace(" ", "_").replace(".", "_")
    filename = f"{rank}_{id_5digit}_vox_{clean_name}_{gender}.mp3"
    print(f"[{rank:03d}] {filename}  (Preset: {folder})")

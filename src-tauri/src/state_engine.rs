pub fn determine_state(status0: &str, status1: &str, remarks: &str, description: &str) -> String {
    let s0 = status0.trim().to_uppercase();
    let s1 = status1.trim().to_uppercase();
    let rem = remarks.trim().to_lowercase();
    let desc = description.trim().to_lowercase();

    // 1. Remarks/Description check for offline state
    if rem.contains("offline")
        || rem.contains("communication failure")
        || rem.contains("device unreachable")
        || desc.contains("fail")
        || desc.contains("offline")
    {
        return "OFFLINE".to_string();
    }

    // 2. Status combinations
    if s0 == "ON" && s1 == "OFF" {
        "ON".to_string()
    } else if s0 == "OFF" && s1 == "ON" {
        "OFF".to_string()
    } else if s0 == "OFF" && s1 == "OFF" {
        "OFFLINE".to_string()
    } else if s0.is_empty() || s1.is_empty() {
        "UNKNOWN".to_string()
    } else {
        "UNKNOWN".to_string()
    }
}

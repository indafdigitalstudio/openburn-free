//! Backend desktop OpenBurn: akses port serial native (WebView2 tidak menyediakan Web Serial).

use std::{
    io::{Read, Write},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};

use serialport::SerialPort;
use tauri::{AppHandle, Emitter, State};

struct Conn {
    port: Box<dyn SerialPort>,
    stop: Arc<AtomicBool>,
}

#[derive(Default)]
struct SerialState(Mutex<Option<Conn>>);

#[tauri::command]
fn serial_list() -> Vec<String> {
    serialport::available_ports()
        .map(|ports| ports.into_iter().map(|p| p.port_name).collect())
        .unwrap_or_default()
}

#[tauri::command]
fn serial_open(app: AppHandle, state: State<SerialState>, port: String, baud: u32) -> Result<(), String> {
    close_inner(&state);
    let mut writer = serialport::new(&port, baud)
        .timeout(Duration::from_millis(50))
        .open()
        .map_err(|e| e.to_string())?;
    // GRBL di banyak board (CH340/Arduino) reset saat DTR berubah; nyalakan agar boot message muncul
    let _ = writer.write_data_terminal_ready(true);
    let mut reader = writer.try_clone().map_err(|e| e.to_string())?;
    let stop = Arc::new(AtomicBool::new(false));
    let stop_r = stop.clone();
    *state.0.lock().unwrap() = Some(Conn { port: writer, stop });
    thread::spawn(move || {
        let mut buf = [0u8; 2048];
        loop {
            if stop_r.load(Ordering::Relaxed) {
                break;
            }
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let _ = app.emit("serial-data", buf[..n].to_vec());
                }
                Ok(_) => {}
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {}
                Err(_) => {
                    let _ = app.emit("serial-closed", ());
                    break;
                }
            }
        }
    });
    Ok(())
}

#[tauri::command]
fn serial_write(state: State<SerialState>, data: Vec<u8>) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    match guard.as_mut() {
        Some(c) => {
            c.port.write_all(&data).map_err(|e| e.to_string())?;
            c.port.flush().map_err(|e| e.to_string())
        }
        None => Err("port tidak terbuka".into()),
    }
}

#[tauri::command]
fn serial_close(state: State<SerialState>) -> Result<(), String> {
    close_inner(&state);
    Ok(())
}

fn close_inner(state: &State<SerialState>) {
    if let Some(c) = state.0.lock().unwrap().take() {
        c.stop.store(true, Ordering::Relaxed);
        drop(c.port);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SerialState::default())
        .invoke_handler(tauri::generate_handler![serial_list, serial_open, serial_write, serial_close])
        .run(tauri::generate_context!())
        .expect("gagal menjalankan OpenBurn");
}

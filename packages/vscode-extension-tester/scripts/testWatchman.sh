#!/bin/bash

# Prosta funkcja do logowania z kolorami
log() {
    echo -e "\033[0;32m[INFO] $1\033[0m"
}

error() {
    echo -e "\033[0;31m[ERROR] $1\033[0m" >&2
    exit 1
}

# --- Krok 1: Sprawdzenie zależności ---
log "Sprawdzanie zależności: Homebrew i Watchman..."
if ! command -v watchman &> /dev/null; then
    log "Watchman nie znaleziony. Instalowanie przez Homebrew..."
    brew install watchman || error "Instalacja Watchmana nie powiodła się."
else
    log "Watchman jest już zainstalowany."
fi

# --- Krok 2: Przygotowanie środowiska testowego ---
TEST_DIR=$(mktemp -d)
cd "$TEST_DIR"
log "Utworzono i przełączono na katalog testowy: $TEST_DIR"

# --- Krok 3: Uruchomienie monitorowania ---
log "Uruchamianie monitorowania Watchman dla katalogu..."
watchman watch . > /dev/null || error "Nie udało się uruchomić monitorowania w katalogu."

# --- Krok 4: Symulacja i nasłuchiwanie ---
LOG_FILE="watchman_events.log"
EXPECTED_CHANGES=4

log "Uruchamianie symulacji operacji na plikach w tle..."

# Uruchom wszystkie operacje na plikach w jednym procesie w tle
(
    # Daj chwilę, aby pętla nasłuchująca mogła wystartować
    sleep 1
    log "  -> Zdarzenie 1: Tworzenie pliku test.txt"
    touch test.txt
    sleep 1
    log "  -> Zdarzenie 2: Modyfikacja pliku test.txt"
    echo "Hello" > test.txt
    sleep 1
    log "  -> Zdarzenie 3: Zmiana nazwy na new_test.txt"
    mv test.txt new_test.txt
    sleep 1
    log "  -> Zdarzenie 4: Usunięcie pliku new_test.txt"
    rm new_test.txt
) &

log "Uruchamianie nasłuchu na $EXPECTED_CHANGES kolejnych zmian..."

# W pętli czekaj na każdą ze zmian za pomocą watchman-wait
for i in $(seq 1 $EXPECTED_CHANGES); do
    log "Czekam na zdarzenie #$i..."
    # watchman-wait zablokuje działanie, aż wykryje zmianę, a potem się zakończy.
    # Timeout 10 sekund na wszelki wypadek.
    OUTPUT=$(watchman-wait . --timeout 10 -p '**/*.*')
    
    if [ -n "$OUTPUT" ]; then
        # watchman-wait może zwrócić wiele plików w jednej linii, jeśli zmiany są szybkie
        log "Wykryto zmianę: $OUTPUT"
        echo "Zmiana #$i: $OUTPUT" >> "$LOG_FILE"
    else
        error "Nie wykryto zmiany #$i w ciągu 10 sekund. Test nie powiódł się."
        break
    fi
done

# --- Krok 5: Zakończenie testu i posprzątanie ---
log "Test zakończony. Zatrzymywanie monitorowania..."
watchman watch-del
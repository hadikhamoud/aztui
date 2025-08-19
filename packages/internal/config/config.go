package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

type Config struct {
	AzureOrgURL string `json:"azure_org_url"`
	AzurePAT    string `json:"azure_pat"`
}

func getXDGConfigPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".config", "aztui", "config.json")
}

func LoadConfig() (*Config, error) {
	config := &Config{}

	// First try to load from XDG config directory
	configPath := getXDGConfigPath()
	if _, err := os.Stat(configPath); err == nil {
		data, err := os.ReadFile(configPath)
		if err == nil {
			if err := json.Unmarshal(data, config); err == nil {
				// If we have both values from config file, return them
				if config.AzureOrgURL != "" && config.AzurePAT != "" {
					return config, nil
				}
			}
		}
	}

	// Fallback to .env file if config values are missing
	envPath := filepath.Join("..", ".env")
	if err := godotenv.Load(envPath); err == nil {
		if config.AzureOrgURL == "" {
			config.AzureOrgURL = os.Getenv("AZURE_ORG_URL")
		}
		if config.AzurePAT == "" {
			config.AzurePAT = os.Getenv("AZURE_PAT")
		}
	}

	// Check environment variables directly if still missing
	if config.AzureOrgURL == "" {
		config.AzureOrgURL = os.Getenv("AZURE_ORG_URL")
	}
	if config.AzurePAT == "" {
		config.AzurePAT = os.Getenv("AZURE_PAT")
	}

	return config, nil
}

func (c *Config) IsComplete() bool {
	return c.AzureOrgURL != "" && c.AzurePAT != ""
}

func (c *Config) Save() error {
	configPath := getXDGConfigPath()

	// Ensure directory exists
	dir := filepath.Dir(configPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %v", err)
	}

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %v", err)
	}

	if err := os.WriteFile(configPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write config file: %v", err)
	}

	return nil
}

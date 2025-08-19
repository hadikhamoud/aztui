package config

import (
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type ConfigModal struct {
	config    *Config
	inputs    []textinput.Model
	focused   int
	width     int
	height    int
	completed bool
}

type ConfigCompleteMsg struct {
	Config *Config
}

func NewConfigModal(config *Config) *ConfigModal {
	m := &ConfigModal{
		config:    config,
		inputs:    make([]textinput.Model, 2),
		focused:   0,
		completed: false,
	}

	// Create Azure Organization URL input
	m.inputs[0] = textinput.New()
	m.inputs[0].Placeholder = "https://dev.azure.com/yourorg"
	m.inputs[0].Focus()
	m.inputs[0].CharLimit = 256
	m.inputs[0].Width = 50
	m.inputs[0].SetValue(config.AzureOrgURL)

	// Create Personal Access Token input
	m.inputs[1] = textinput.New()
	m.inputs[1].Placeholder = "Your Azure DevOps Personal Access Token"
	m.inputs[1].EchoMode = textinput.EchoPassword
	m.inputs[1].EchoCharacter = '•'
	m.inputs[1].CharLimit = 256
	m.inputs[1].Width = 50
	m.inputs[1].SetValue(config.AzurePAT)

	return m
}

func (m *ConfigModal) Init() tea.Cmd {
	return textinput.Blink
}

func (m *ConfigModal) Update(msg tea.Msg) (*ConfigModal, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "esc":
			m.completed = true
			return m, tea.Quit

		case "tab", "shift+tab", "up", "down":
			if msg.String() == "up" || msg.String() == "shift+tab" {
				m.focused--
			} else {
				m.focused++
			}

			if m.focused > len(m.inputs)-1 {
				m.focused = 0
			} else if m.focused < 0 {
				m.focused = len(m.inputs) - 1
			}

			for i := 0; i < len(m.inputs); i++ {
				if i == m.focused {
					cmds = append(cmds, m.inputs[i].Focus())
				} else {
					m.inputs[i].Blur()
				}
			}

			return m, tea.Batch(cmds...)

		case "enter":
			// Save configuration
			m.config.AzureOrgURL = strings.TrimSpace(m.inputs[0].Value())
			m.config.AzurePAT = strings.TrimSpace(m.inputs[1].Value())

			if m.config.IsComplete() {
				if err := m.config.Save(); err == nil {
					m.completed = true
					return m, func() tea.Msg {
						return ConfigCompleteMsg{Config: m.config}
					}
				}
			}
		}
	}

	// Update inputs
	for i := 0; i < len(m.inputs); i++ {
		var inputCmd tea.Cmd
		m.inputs[i], inputCmd = m.inputs[i].Update(msg)
		if inputCmd != nil {
			cmds = append(cmds, inputCmd)
		}
	}

	return m, tea.Batch(cmds...)
}

func (m *ConfigModal) View() string {
	var b strings.Builder

	// Modal styling
	modalStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("12")).
		Padding(1, 2).
		Width(60).
		Align(lipgloss.Center)

	titleStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("12")).
		Bold(true).
		Align(lipgloss.Center)

	labelStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("15")).
		Bold(true)

	helpStyle := lipgloss.NewStyle().
		Foreground(lipgloss.Color("240")).
		Align(lipgloss.Center)

	// Build modal content
	b.WriteString(titleStyle.Render("Azure DevOps Configuration"))
	b.WriteString("\n\n")
	b.WriteString("Please provide your Azure DevOps credentials to continue.\n\n")

	// Organization URL field
	b.WriteString(labelStyle.Render("Azure Organization URL:"))
	b.WriteString("\n")
	b.WriteString(m.inputs[0].View())
	b.WriteString("\n\n")

	// Personal Access Token field
	b.WriteString(labelStyle.Render("Personal Access Token:"))
	b.WriteString("\n")
	b.WriteString(m.inputs[1].View())
	b.WriteString("\n\n")

	// Validation message
	if m.inputs[0].Value() != "" && m.inputs[1].Value() != "" {
		if !m.config.IsComplete() || (strings.TrimSpace(m.inputs[0].Value()) == "" || strings.TrimSpace(m.inputs[1].Value()) == "") {
			errorStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("1"))
			b.WriteString(errorStyle.Render("⚠ Both fields are required"))
			b.WriteString("\n")
		}
	}

	// Help text
	b.WriteString(helpStyle.Render("Tab/↑↓: Navigate • Enter: Save • Esc: Cancel"))

	// Center the modal on screen
	content := modalStyle.Render(b.String())

	// Calculate positioning to center the modal
	terminalStyle := lipgloss.NewStyle().
		Width(m.width).
		Height(m.height).
		Align(lipgloss.Center).
		AlignVertical(lipgloss.Center)

	return terminalStyle.Render(content)
}

func (m *ConfigModal) IsCompleted() bool {
	return m.completed
}

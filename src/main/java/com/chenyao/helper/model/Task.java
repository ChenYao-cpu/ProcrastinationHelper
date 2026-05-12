package com.chenyao.helper.model;

public class Task {
    private int id;
    private String name;
    private int time;
    private int priority;
    private boolean completed;
    private String category;
    private String createdAt;
    
    public Task() {}
    
    public Task(String name, int time, int priority, String category) {
        this.name = name;
        this.time = time;
        this.priority = priority;
        this.category = category;
        this.completed = false;
    }
    
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getTime() { return time; }
    public void setTime(int time) { this.time = time; }
    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}

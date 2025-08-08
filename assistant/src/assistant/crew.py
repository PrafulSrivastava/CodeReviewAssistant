from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent
from typing import List
# If you want to run a snippet of code before or after the crew starts,
# you can use the @before_kickoff and @after_kickoff decorators
# https://docs.crewai.com/concepts/crews#example-crew-class-with-decorators

@CrewBase
class Assistant():
    """Assistant crew"""

    agents: List[BaseAgent]
    tasks: List[Task]

    @agent
    def FunctionDescriber(self) -> Agent:
        return Agent(
            config=self.agents_config['FunctionDescriber'],  # type: ignore[index]
            verbose=True
        )

    @agent
    def CodeChangeProspector(self) -> Agent:
        return Agent(
            config=self.agents_config['CodeChangeProspector'],  # type: ignore[index]
            verbose=True
        )

    @agent
    def CodeChangeCritic(self) -> Agent:
        return Agent(
            config=self.agents_config['CodeChangeCritic'],  # type: ignore[index]
            verbose=True
        )

    @agent
    def CodeChangeSummarizer(self) -> Agent:
        return Agent(
            config=self.agents_config['CodeChangeSummarizer'],  # type: ignore[index]
            verbose=True
        )

    @task
    def DescribeFunctionPurpose(self) -> Task:
        return Task(
            config=self.tasks_config['DescribeFunctionPurpose'],  # type: ignore[index]
        )

    @task
    def IdentifyCodeChangePros(self) -> Task:
        return Task(
            config=self.tasks_config['IdentifyCodeChangePros'],  # type: ignore[index]
        )

    @task
    def IdentifyCodeChangeCons(self) -> Task:
        return Task(
            config=self.tasks_config['IdentifyCodeChangeCons'],  # type: ignore[index]
        )

    @task
    def SummarizeCodeChangeReport(self) -> Task:
        return Task(
            config=self.tasks_config['SummarizeCodeChangeReport'],  # type: ignore[index]
        )


    @crew
    def crew(self) -> Crew:
        """Creates the Assistant crew"""
        # To learn how to add knowledge sources to your crew, check out the documentation:
        # https://docs.crewai.com/concepts/knowledge#what-is-knowledge

        return Crew(
            agents=self.agents, # Automatically created by the @agent decorator
            tasks=self.tasks, # Automatically created by the @task decorator
            process=Process.sequential,
            verbose=True,
            # process=Process.hierarchical, # In case you wanna use that instead https://docs.crewai.com/how-to/Hierarchical/
        )

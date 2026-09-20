using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SdnVigia.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMissionCodeAndRecommendedSkills : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Code",
                table: "Missions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "RecommendedSkillsJson",
                table: "Missions",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Code",
                table: "Missions");

            migrationBuilder.DropColumn(
                name: "RecommendedSkillsJson",
                table: "Missions");
        }
    }
}
